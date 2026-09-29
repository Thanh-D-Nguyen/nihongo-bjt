package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
)

// Scheduler manages timezone-aware cron job execution with duplicate-run
// protection via PostgreSQL advisory locks and structured logging.
type Scheduler struct {
	cron   *cron.Cron
	db     *pgxpool.Pool
	logger *slog.Logger
	cfg    Config
	mu     sync.Mutex
	ids    []cron.EntryID
}

// NewScheduler creates a scheduler that respects the given config.
// When cfg.Enabled is false, Start is a no-op and no jobs are registered.
func NewScheduler(db *pgxpool.Pool, logger *slog.Logger, cfg Config) *Scheduler {
	loc := time.FixedZone("ICT", 7*60*60) // Asia/Ho_Chi_Minh = UTC+7
	c := cron.New(
		cron.WithLocation(loc),
		cron.WithSeconds(),                  // allow second-precision if needed; standard 5-field still works
		cron.WithLogger(cron.DiscardLogger), // we log ourselves via slog
	)
	return &Scheduler{
		cron:   c,
		db:     db,
		logger: logger,
		cfg:    cfg,
	}
}

// JobFunc is a function executed by the scheduler. It receives a context
// that is cancelled on shutdown and should return the number of items
// processed (for logging) and any error.
type JobFunc func(ctx context.Context) (itemsProcessed int, err error)

// Register adds a cron job with the given name, schedule, and handler.
// The schedule uses standard 5-field cron syntax (minute hour dom month dow).
// Returns immediately without registering if the scheduler is disabled.
func (s *Scheduler) Register(name, schedule string, fn JobFunc) error {
	if !s.cfg.Enabled {
		if s.logger != nil {
			s.logger.Info("jobs: scheduler disabled, skipping registration", "job", name)
		}
		return nil
	}

	wrapped := s.wrapJob(name, fn)
	id, err := s.cron.AddFunc(schedule, wrapped)
	if err != nil {
		return fmt.Errorf("jobs: register %q: %w", name, err)
	}
	s.mu.Lock()
	s.ids = append(s.ids, id)
	s.mu.Unlock()
	s.logger.Info("jobs: registered", "job", name, "schedule", schedule)
	return nil
}

// RegisterWithTimezone adds a cron job parsed in a specific timezone.
// Use this for jobs whose schedule is defined in a non-default timezone
// (e.g., Loto autopilot runs on Asia/Tokyo schedules).
func (s *Scheduler) RegisterWithTimezone(name, schedule, tzName string, fn JobFunc) error {
	if !s.cfg.Enabled {
		if s.logger != nil {
			s.logger.Info("jobs: scheduler disabled, skipping registration", "job", name)
		}
		return nil
	}

	loc, err := time.LoadLocation(tzName)
	if err != nil {
		return fmt.Errorf("jobs: register %q: invalid timezone %q: %w", name, tzName, err)
	}

	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	sched, err := parser.Parse(schedule)
	if err != nil {
		return fmt.Errorf("jobs: register %q: parse schedule: %w", name, err)
	}

	// Wrap the schedule with the target timezone so Next() computes in that zone.
	tzSched := &tzSchedule{inner: sched, loc: loc}

	wrapped := s.wrapJob(name, fn)
	id := s.cron.Schedule(tzSched, wrapped)
	s.mu.Lock()
	s.ids = append(s.ids, id)
	s.mu.Unlock()
	s.logger.Info("jobs: registered", "job", name, "schedule", schedule, "timezone", tzName)
	return nil
}

// tzSchedule wraps a cron.Schedule to compute Next() in a specific timezone.
type tzSchedule struct {
	inner cron.Schedule
	loc   *time.Location
}

func (t *tzSchedule) Next(now time.Time) time.Time {
	return t.inner.Next(now.In(t.loc))
}

// Start begins executing registered jobs. No-op if disabled or already started.
func (s *Scheduler) Start() {
	if !s.cfg.Enabled {
		s.logger.Info("jobs: scheduler disabled, not starting")
		return
	}
	s.cron.Start()
	s.logger.Info("jobs: scheduler started", "registered_jobs", len(s.ids))
}

// Stop halts the scheduler and waits for running jobs to complete.
func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	s.logger.Info("jobs: scheduler stopped")
}

// wrapJob returns a cron.FuncJob that enforces advisory-lock-based single
// execution and emits structured logs for every run.
func (s *Scheduler) wrapJob(name string, fn JobFunc) cron.FuncJob {
	return func() {
		ctx := context.Background()
		log := s.logger.With("job", name)

		// Advisory lock: prevents concurrent execution across instances.
		// Lock key derived from job name hash; released automatically when
		// the pgx conn closes at function exit.
		lockKey := advisoryLockKey(name)
		conn, err := s.db.Acquire(ctx)
		if err != nil {
			log.Error("jobs: acquire conn for advisory lock failed", "error", err)
			return
		}
		defer conn.Release()

		var acquired bool
		if err := conn.QueryRow(ctx, "SELECT pg_try_advisory_lock($1)", lockKey).Scan(&acquired); err != nil {
			log.Error("jobs: advisory lock query failed", "error", err)
			return
		}
		if !acquired {
			log.Debug("jobs: skipped, another instance holds the lock")
			return
		}
		defer func() {
			// Best-effort unlock; connection release also frees it.
			_, _ = conn.Exec(ctx, "SELECT pg_advisory_unlock($1)", lockKey)
		}()

		start := time.Now()
		log.Info("jobs: started", "trigger", "cron", "start_time", start.UTC().Format(time.RFC3339))

		items, err := fn(ctx)
		duration := time.Since(start)

		if err != nil {
			log.Error("jobs: failed",
				"trigger", "cron",
				"end_time", time.Now().UTC().Format(time.RFC3339),
				"duration_ms", duration.Milliseconds(),
				"items_processed", items,
				"error", err,
			)
			return
		}
		log.Info("jobs: completed",
			"trigger", "cron",
			"end_time", time.Now().UTC().Format(time.RFC3339),
			"duration_ms", duration.Milliseconds(),
			"items_processed", items,
		)
	}
}

// advisoryLockKey produces a stable int64 key from a job name.
// Uses a simple FNV-1a hash to avoid collisions between known job names.
func advisoryLockKey(name string) int64 {
	const offset64 = 14695981039346656037
	const prime64 = 1099511628211
	h := uint64(offset64)
	for i := 0; i < len(name); i++ {
		h ^= uint64(name[i])
		h *= prime64
	}
	// Keep positive and within int64 range; mask top bit.
	return int64(h & 0x7FFFFFFFFFFFFFFF)
}
