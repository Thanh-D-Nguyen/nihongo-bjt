package httpserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const passwordResetQueueSize = 32

type passwordResetJob struct {
	id       int64
	email    string
	locale   string
	attempts int
}

// PasswordResetQueue persists requests before acknowledging them and retries
// claimed work after a worker or API restart.
type PasswordResetQueue struct {
	db     *pgxpool.Pool
	mailer PasswordResetMailer
	logger *slog.Logger
	ctx    context.Context
	cancel context.CancelFunc
	mu     sync.RWMutex
	closed bool
	wg     sync.WaitGroup
	done   chan struct{}
}

func NewPasswordResetQueue(db *pgxpool.Pool, mailer PasswordResetMailer, logger *slog.Logger) *PasswordResetQueue {
	ctx, cancel := context.WithCancel(context.Background())
	if logger == nil {
		logger = slog.Default()
	}
	q := &PasswordResetQueue{db: db, mailer: mailer, logger: logger, ctx: ctx, cancel: cancel, done: make(chan struct{})}
	for range 2 {
		q.wg.Add(1)
		go q.run()
	}
	go func() { q.wg.Wait(); close(q.done) }()
	return q
}

func (q *PasswordResetQueue) Enqueue(email, locale string) bool {
	q.mu.RLock()
	defer q.mu.RUnlock()
	if q.closed || q.db == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(q.ctx, 2*time.Second)
	defer cancel()
	tx, err := q.db.Begin(ctx)
	if err != nil {
		q.logger.Error("forgot-password: persist request failed", "error", err)
		return false
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('auth.password_reset_request'))`); err != nil {
		q.logger.Error("forgot-password: lock request queue failed", "error", err)
		return false
	}
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO auth.password_reset_request (email, locale)
		SELECT $1, $2
		WHERE (SELECT count(*) FROM auth.password_reset_request) < $3
		RETURNING id`, email, locale, passwordResetQueueSize).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false
	}
	if err != nil {
		q.logger.Error("forgot-password: persist request failed", "error", err)
		return false
	}
	if err := tx.Commit(ctx); err != nil {
		q.logger.Error("forgot-password: commit request failed", "error", err)
		return false
	}
	return true
}

func (q *PasswordResetQueue) Close(ctx context.Context) error {
	q.mu.Lock()
	if !q.closed {
		q.closed = true
		q.cancel()
	}
	q.mu.Unlock()
	select {
	case <-q.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (q *PasswordResetQueue) run() {
	defer q.wg.Done()
	if q.db == nil {
		return
	}
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-q.ctx.Done():
			return
		default:
		}
		job, ok, err := q.claim()
		if err != nil {
			q.logger.Error("forgot-password: claim request failed", "error", err)
		} else if ok {
			q.processClaimed(job)
			continue
		}
		select {
		case <-q.ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (q *PasswordResetQueue) processClaimed(job passwordResetJob) {
	if job.attempts > 5 {
		q.remove(job.id)
		return
	}
	ctx, cancel := context.WithTimeout(q.ctx, 10*time.Second)
	err := q.process(ctx, job.email, job.locale)
	cancel()
	if err != nil {
		q.logger.Error("forgot-password: process request failed", "error", err)
		q.release(job)
	} else {
		q.remove(job.id)
	}
}

func (q *PasswordResetQueue) claim() (passwordResetJob, bool, error) {
	var job passwordResetJob
	err := q.db.QueryRow(q.ctx, `
		WITH candidate AS (
			SELECT id FROM auth.password_reset_request
			WHERE available_at <= now()
			  AND (claimed_at IS NULL OR claimed_at < now() - interval '1 minute')
			ORDER BY created_at
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		UPDATE auth.password_reset_request request
		SET claimed_at = now(), attempts = request.attempts + 1
		FROM candidate
		WHERE request.id = candidate.id
		RETURNING request.id, request.email, request.locale, request.attempts`).
		Scan(&job.id, &job.email, &job.locale, &job.attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return passwordResetJob{}, false, nil
	}
	return job, err == nil, err
}

func (q *PasswordResetQueue) release(job passwordResetJob) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if job.attempts >= 5 {
		_, err := q.db.Exec(ctx, `DELETE FROM auth.password_reset_request WHERE id = $1`, job.id)
		if err != nil {
			q.logger.Error("forgot-password: remove exhausted request failed", "error", err)
		}
		return
	}
	delay := time.Second * time.Duration(1<<job.attempts)
	if delay > time.Minute {
		delay = time.Minute
	}
	_, err := q.db.Exec(ctx, `UPDATE auth.password_reset_request SET claimed_at = NULL, available_at = now() + $2::interval WHERE id = $1`, job.id, delay.String())
	if err != nil {
		q.logger.Error("forgot-password: release request failed", "error", err)
	}
}

func (q *PasswordResetQueue) remove(id int64) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if _, err := q.db.Exec(ctx, `DELETE FROM auth.password_reset_request WHERE id = $1`, id); err != nil {
		q.logger.Error("forgot-password: remove completed request failed", "error", err)
	}
}

func (q *PasswordResetQueue) process(ctx context.Context, email, locale string) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	userID, err := lookupUserIDByEmail(ctx, q.db, email)
	if err != nil {
		return err
	}
	if userID == "" {
		return nil
	}
	rawToken := make([]byte, rawResetTokenLen)
	if _, err := rand.Read(rawToken); err != nil {
		return err
	}
	token := hex.EncodeToString(rawToken)
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])
	if err := storeResetToken(ctx, q.db, userID, tokenHash, time.Now().Add(resetTokenTTL)); err != nil {
		return err
	}
	if err := q.mailer.SendPasswordReset(ctx, email, token, locale); err != nil {
		_, _ = q.db.Exec(ctx, `UPDATE auth.password_reset_token SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL`, tokenHash)
		return err
	}
	return nil
}

var _ PasswordResetRequestQueue = (*PasswordResetQueue)(nil)
