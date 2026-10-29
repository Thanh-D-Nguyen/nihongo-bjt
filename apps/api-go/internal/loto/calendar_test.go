package loto

import (
	"testing"
	"time"
)

func TestNextScheduledDrawDateFollowsJapanSchedule(t *testing.T) {
	cases := []struct {
		game  Game
		after string
		want  string
	}{
		{Loto6, "2026-10-26", "2026-10-29"}, // Monday → Thursday
		{Loto6, "2026-10-29", "2026-11-02"}, // Thursday → next Monday
		{Loto7, "2026-10-23", "2026-10-30"}, // Friday → next Friday
		{Loto7, "2026-10-24", "2026-10-30"},
	}
	for _, c := range cases {
		got, err := NextScheduledDrawDate(c.game, c.after)
		if err != nil || got != c.want {
			t.Errorf("NextScheduledDrawDate(%s, %s) = %q, %v; want %q", c.game, c.after, got, err, c.want)
		}
	}
	if _, err := NextScheduledDrawDate(Loto6, "2026-13-40"); err == nil {
		t.Error("an impossible calendar date must be rejected")
	}
}

func TestResolveAutopilotTargetWaitsOnlyWhenTheDrawHasPassedWithoutAResult(t *testing.T) {
	jstTime := func(day string, hour, minute int) time.Time {
		date, err := ParseDateKey(day)
		if err != nil {
			t.Fatal(err)
		}
		return time.Date(date.Year(), date.Month(), date.Day(), hour, minute, 0, 0, jst)
	}
	cases := []struct {
		name   string
		latest string
		now    time.Time
		status TargetStatus
		target string
	}{
		{"day before the draw", "2026-10-26", jstTime("2026-10-28", 12, 0), StatusReady, "2026-10-29"},
		{"draw day before 18:45 is still ahead", "2026-10-26", jstTime("2026-10-29", 12, 0), StatusReady, "2026-10-29"},
		{"draw day one minute before the draw", "2026-10-26", jstTime("2026-10-29", 18, 44), StatusReady, "2026-10-29"},
		{"draw day after 18:45 without a result", "2026-10-26", jstTime("2026-10-29", 19, 30), StatusWaitingResult, "2026-10-29"},
		{"a missed result days later", "2026-10-26", jstTime("2026-10-31", 9, 0), StatusWaitingResult, "2026-10-29"},
		{"result arrived on draw night", "2026-10-29", jstTime("2026-10-29", 23, 0), StatusReady, "2026-11-02"},
	}
	for _, c := range cases {
		got, err := ResolveAutopilotTarget(Loto6, c.latest, c.now)
		if err != nil || got.Status != c.status || got.DateKey != c.target {
			t.Errorf("%s: got %+v, %v; want %s for %s", c.name, got, err, c.status, c.target)
		}
	}
}

func TestEstimateDrawNumberIsExactOnlyForTheNextScheduledDraw(t *testing.T) {
	number, estimated, err := EstimateDrawNumber(Loto6, 2149, "2026-10-26", "2026-10-29")
	if err != nil || number != 2150 || estimated {
		t.Fatalf("next draw = %d estimated=%v err=%v; want exact 2150", number, estimated, err)
	}
	number, estimated, err = EstimateDrawNumber(Loto6, 2149, "2026-10-26", "2026-11-02")
	if err != nil || number != 2151 || !estimated {
		t.Fatalf("two draws ahead = %d estimated=%v err=%v; want estimated 2151", number, estimated, err)
	}
}

func TestJSTDateKeyRollsOverAtNineHoursAhead(t *testing.T) {
	at := time.Date(2026, 10, 28, 16, 0, 0, 0, time.UTC)
	if got := JSTDateKey(at); got != "2026-10-29" {
		t.Fatalf("JSTDateKey(%v) = %s, want 2026-10-29", at, got)
	}
	if got := DayJP("2026-10-29"); got != "木曜日" {
		t.Fatalf("DayJP = %q, want 木曜日", got)
	}
}

func TestNewYearBreakIsSkipped(t *testing.T) {
	next, err := NextScheduledDrawDate(Loto6, "2026-12-28")
	if err != nil || next != "2027-01-04" {
		t.Fatalf("after Mon 2026-12-28 got %q, %v; want Mon 2027-01-04 (Thu 12-31 is suspended)", next, err)
	}
	next, err = NextScheduledDrawDate(Loto7, "2026-12-25")
	if err != nil || next != "2027-01-08" {
		t.Fatalf("after Fri 2026-12-25 got %q, %v; want Fri 2027-01-08 (Fri 01-01 is suspended)", next, err)
	}
	if IsScheduledDrawDate(Loto6, "2026-12-31") || IsScheduledDrawDate(Loto7, "2027-01-01") {
		t.Fatal("year-end dates must not count as draw dates")
	}
	count, err := ScheduledDrawsBetween(Loto6, "2026-12-28", "2027-01-04")
	if err != nil || count != 1 {
		t.Fatalf("draws between = %d, %v; want only 2027-01-04", count, err)
	}
}
