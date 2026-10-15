package httpserver

import (
	"context"
	"fmt"
	"log/slog"
	"testing"
	"time"
)

func TestPasswordResetQueueRejectsEnqueueAfterClose(t *testing.T) {
	queue := NewPasswordResetQueue(nil, nil, slog.Default())
	if err := queue.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
	if queue.Enqueue("learner@example.com", "en") {
		t.Fatal("closed queue must reject new jobs")
	}
}

func TestPasswordResetQueueCloseReturnsWhenCallerContextIsCancelled(t *testing.T) {
	ctx, cancelQueue := context.WithCancel(context.Background())
	queue := &PasswordResetQueue{ctx: ctx, cancel: cancelQueue, done: make(chan struct{})}
	deadline, stop := context.WithCancel(context.Background())
	stop()
	started := time.Now()
	if err := queue.Close(deadline); err != context.Canceled {
		t.Fatalf("expected canceled shutdown wait, got %v", err)
	}
	if time.Since(started) > time.Second {
		t.Fatal("shutdown should return promptly when the caller stops waiting")
	}
}

func TestPasswordResetQueuePersistsJobsAndRejectsAtCapacity(t *testing.T) {
	db := testPool(t)
	if _, err := db.Exec(context.Background(), `DELETE FROM auth.password_reset_request`); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM auth.password_reset_request`)
	queue := &PasswordResetQueue{db: db, logger: slog.Default(), ctx: context.Background()}
	if !queue.Enqueue("first@example.invalid", "vi") {
		t.Fatal("expected request to persist")
	}
	restartedQueue := &PasswordResetQueue{db: db, logger: slog.Default(), ctx: context.Background()}
	job, ok, err := restartedQueue.claim()
	if err != nil || !ok {
		t.Fatalf("request should be recoverable by a new worker, ok=%v err=%v", ok, err)
	}
	if job.email != "first@example.invalid" || job.locale != "vi" || job.attempts != 1 {
		t.Fatalf("unexpected persisted job: %#v", job)
	}
	for i := 1; i < passwordResetQueueSize; i++ {
		if !queue.Enqueue(fmt.Sprintf("learner-%d@example.invalid", i), "en") {
			t.Fatalf("expected request %d to fit in bounded queue", i+1)
		}
	}
	if queue.Enqueue("overflow@example.invalid", "en") {
		t.Fatal("queue must reject requests at persistent capacity")
	}
}

func TestPasswordResetQueueDoesNotRetryAnExhaustedExpiredClaim(t *testing.T) {
	db := testPool(t)
	if _, err := db.Exec(context.Background(), `DELETE FROM auth.password_reset_request`); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM auth.password_reset_request`)
	userID := newUUID(t)
	email := "exhausted-reset-" + userID[:8] + "@example.test"
	seedActiveUser(t, db, userID, "Exhausted reset test", email, "")
	if _, err := db.Exec(context.Background(), `INSERT INTO auth.password_reset_request (email, locale, attempts, available_at, claimed_at) VALUES ($1, 'en', 5, now()-interval '1 minute', now()-interval '2 minutes')`, email); err != nil {
		t.Fatal(err)
	}
	mailer := &testPasswordResetMailer{}
	queue := NewPasswordResetQueue(db, mailer, slog.Default())
	t.Cleanup(func() { _ = queue.Close(context.Background()) })
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		var remaining int
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM auth.password_reset_request WHERE email=$1`, email).Scan(&remaining); err != nil {
			t.Fatal(err)
		}
		if remaining == 0 {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	var remaining int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM auth.password_reset_request WHERE email=$1`, email).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("exhausted request should be removed, remaining=%d err=%v", remaining, err)
	}
	if recipient, _, _ := mailer.snapshot(); recipient != "" {
		t.Fatal("a request claimed after its retry budget must not create another reset token or email")
	}
}
