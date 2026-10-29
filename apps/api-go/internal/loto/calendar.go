package loto

import (
	"fmt"
	"time"
)

const dateLayout = "2006-01-02"

// jst is the draw calendar: Japan has no daylight-saving time.
var jst = time.FixedZone("JST", 9*60*60)

var dayJP = [...]string{"日", "月", "火", "水", "木", "金", "土"}

// JSTDateKey returns the JST calendar date of an instant as YYYY-MM-DD.
func JSTDateKey(at time.Time) string { return at.In(jst).Format(dateLayout) }

// ParseDateKey strictly parses YYYY-MM-DD into UTC midnight.
func ParseDateKey(value string) (time.Time, error) {
	parsed, err := time.Parse(dateLayout, value)
	if err != nil || parsed.Format(dateLayout) != value {
		return time.Time{}, fmt.Errorf("%w: %q must use YYYY-MM-DD", ErrInvalidDate, value)
	}
	return parsed, nil
}

// DayJP returns the Japanese weekday label such as 月曜日 for a date key.
func DayJP(dateKey string) string {
	date, err := ParseDateKey(dateKey)
	if err != nil {
		return ""
	}
	return dayJP[date.Weekday()] + "曜日"
}

func isDrawWeekday(spec Spec, weekday time.Weekday) bool {
	for _, candidate := range spec.DrawWeekdays {
		if candidate == weekday {
			return true
		}
	}
	return false
}

// inYearEndBreak reports the New Year suspension (31 Dec – 3 Jan): no Loto
// draw has been held on those dates in the official history since at least 2018.
func inYearEndBreak(date time.Time) bool {
	return (date.Month() == time.December && date.Day() == 31) || (date.Month() == time.January && date.Day() <= 3)
}

// isDrawDay combines the weekly schedule with the New Year suspension.
func isDrawDay(spec Spec, date time.Time) bool {
	return isDrawWeekday(spec, date.Weekday()) && !inYearEndBreak(date)
}

// IsScheduledDrawDate reports whether the game normally draws on dateKey.
func IsScheduledDrawDate(game Game, dateKey string) bool {
	date, err := ParseDateKey(dateKey)
	if err != nil {
		return false
	}
	return isDrawDay(SpecFor(game), date)
}

// NextScheduledDrawDate returns the first scheduled draw date strictly after
// afterKey.
func NextScheduledDrawDate(game Game, afterKey string) (string, error) {
	cursor, err := ParseDateKey(afterKey)
	if err != nil {
		return "", err
	}
	spec := SpecFor(game)
	for offset := 0; offset < 14; offset++ {
		cursor = cursor.AddDate(0, 0, 1)
		if isDrawDay(spec, cursor) {
			return cursor.Format(dateLayout), nil
		}
	}
	return "", fmt.Errorf("%w: no %s draw within two weeks of %s", ErrInvalidDate, game, afterKey)
}

// ScheduledDrawsBetween counts scheduled draw dates in (afterKey, uptoKey].
func ScheduledDrawsBetween(game Game, afterKey, uptoKey string) (int, error) {
	cursor, err := ParseDateKey(afterKey)
	if err != nil {
		return 0, err
	}
	end, err := ParseDateKey(uptoKey)
	if err != nil {
		return 0, err
	}
	spec := SpecFor(game)
	count := 0
	for cursor = cursor.AddDate(0, 0, 1); !cursor.After(end); cursor = cursor.AddDate(0, 0, 1) {
		if isDrawDay(spec, cursor) {
			count++
		}
	}
	return count, nil
}

// EstimateDrawNumber predicts the number of the draw on targetKey from the
// latest known official draw. The estimate is exact when targetKey is the very
// next scheduled draw; later targets (or holiday gaps) are flagged estimated.
func EstimateDrawNumber(game Game, latestNumber int, latestKey, targetKey string) (number int, estimated bool, err error) {
	next, err := NextScheduledDrawDate(game, latestKey)
	if err != nil {
		return 0, false, err
	}
	if next == targetKey {
		return latestNumber + 1, false, nil
	}
	count, err := ScheduledDrawsBetween(game, latestKey, targetKey)
	if err != nil {
		return 0, false, err
	}
	if count < 1 {
		count = 1
	}
	return latestNumber + count, true, nil
}

// TargetStatus is the outcome of resolving the next autopilot cycle.
type TargetStatus string

const (
	StatusReady         TargetStatus = "ready"
	StatusWaitingResult TargetStatus = "waiting_result"
)

// Target is the next draw an autopilot tick should publish a reference set for.
type Target struct {
	Status   TargetStatus
	DateKey  string
	Reason   string
	TodayKey string
}

// drawHour and drawMinute are the JST start time of every Loto draw (18:45).
const (
	drawHour   = 18
	drawMinute = 45
)

// ResolveAutopilotTarget finds the draw following the latest official result.
// A target that is still ahead — including today's draw before 18:45 JST — is
// ready for a reference set. Once its draw time has passed without a result in
// the data, the autopilot has to wait for the next sync.
func ResolveAutopilotTarget(game Game, latestOfficialKey string, now time.Time) (Target, error) {
	local := now.In(jst)
	todayKey := local.Format(dateLayout)
	next, err := NextScheduledDrawDate(game, latestOfficialKey)
	if err != nil {
		return Target{}, err
	}
	beforeDraw := local.Hour() < drawHour || (local.Hour() == drawHour && local.Minute() < drawMinute)
	if next > todayKey || (next == todayKey && beforeDraw) {
		return Target{Status: StatusReady, DateKey: next, TodayKey: todayKey}, nil
	}
	return Target{Status: StatusWaitingResult, DateKey: next, TodayKey: todayKey, Reason: "official result for the latest scheduled draw is not available yet"}, nil
}
