package jobs

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"reflect"
	"testing"
)

func lotoHandlers(enabled bool, fn func(ctx context.Context, game string) (int, error)) *Handlers {
	h := NewHandlers(nil, slog.New(slog.NewTextHandler(io.Discard, nil)), Config{Enabled: true, LotoAutopilotEnabled: enabled})
	h.LotoAutopilotFunc = fn
	return h
}

func TestLotoJobsDelegateToTheAutopilotRunnerPerGame(t *testing.T) {
	var games []string
	h := lotoHandlers(true, func(_ context.Context, game string) (int, error) {
		games = append(games, game)
		return 1, nil
	})
	if n, err := h.LotoAutopilotLoto6(context.Background()); n != 1 || err != nil {
		t.Fatalf("loto6 = %d, %v", n, err)
	}
	if n, err := h.LotoAutopilotLoto7(context.Background()); n != 1 || err != nil {
		t.Fatalf("loto7 = %d, %v", n, err)
	}
	if !reflect.DeepEqual(games, []string{"loto6", "loto7"}) {
		t.Fatalf("runner called for %v", games)
	}
}

func TestLotoCatchupRunsBothGamesAndKeepsTheFirstError(t *testing.T) {
	boom := errors.New("loto6 mirror down")
	var games []string
	h := lotoHandlers(true, func(_ context.Context, game string) (int, error) {
		games = append(games, game)
		if game == "loto6" {
			return 0, boom
		}
		return 1, nil
	})
	published, err := h.LotoAutopilotCatchup(context.Background())
	if !errors.Is(err, boom) || published != 1 {
		t.Fatalf("catchup = %d, %v; want 1 published and the loto6 error", published, err)
	}
	if !reflect.DeepEqual(games, []string{"loto6", "loto7"}) {
		t.Fatalf("a failing game must not stop the other: %v", games)
	}
}

func TestLotoJobsDoNothingWhenDisabledOrUnwired(t *testing.T) {
	called := false
	disabled := lotoHandlers(false, func(context.Context, string) (int, error) { called = true; return 1, nil })
	for _, run := range []func(context.Context) (int, error){disabled.LotoAutopilotLoto6, disabled.LotoAutopilotLoto7, disabled.LotoAutopilotCatchup} {
		if n, err := run(context.Background()); n != 0 || err != nil {
			t.Fatalf("disabled job = %d, %v", n, err)
		}
	}
	if called {
		t.Fatal("the runner must not be called when LOTO_AUTOPILOT_ENABLED is off")
	}
	unwired := lotoHandlers(true, nil)
	if n, err := unwired.LotoAutopilotLoto6(context.Background()); n != 0 || err != nil {
		t.Fatalf("unwired job = %d, %v", n, err)
	}
}
