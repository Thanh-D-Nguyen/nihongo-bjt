package lifefeed

import (
	"strings"
	"testing"
	"time"
)

func TestDateUsesJSTAndOfficialHolidayData(t *testing.T) {
	at := time.Date(2026, 10, 23, 16, 1, 0, 0, time.UTC) // 2026-10-24 01:01 JST
	card := DateCard(at)
	if card.ID != "date:2026-10-24" || card.Scene.Weekday != "土" || strings.Contains(card.Lesson.Title.Japanese, "祝日") {
		t.Fatalf("wrong date or invented holiday: %+v", card)
	}
	holiday := DateCard(time.Date(2026, 11, 3, 10, 0, 0, 0, JST))
	if holiday.Lesson.Source.LicenseStatus != "commercial" || !strings.Contains(holiday.Lesson.Title.Japanese, "祝日") {
		t.Fatalf("holiday missing: %+v", holiday)
	}
	if len(holidayNames) < 30 {
		t.Fatalf("missing official calendar: %d", len(holidayNames))
	}
}
func TestValidatorRejectsUnsafeTeachingContent(t *testing.T) {
	card := DateCard(time.Now())
	card.Topic = "transit"
	card.Scene.Kind = "transit"
	card.ID = "transit:test"
	card.Lesson.ID = card.ID
	if err := ValidateCard(card); err != nil {
		t.Fatalf("valid card: %v", err)
	}
	card.Lesson.Exercises[0].PromptJapanese = "今日は" + card.Lesson.Exercises[0].AcceptedAnswers[0] + "です。"
	if err := ValidateCard(card); err == nil || !strings.Contains(err.Error(), "reveals answer") {
		t.Fatalf("expected recall leak rejection: %v", err)
	}
	card.Lesson.Exercises[0].PromptJapanese = "今日は＿＿です。"
	card.Lesson.Source.URL = "http://example.com"
	if err := ValidateCard(card); err == nil {
		t.Fatal("accepted insecure attribution URL")
	}
	card.Lesson.Source.URL = ""
	card.Lesson.Source.LicenseStatus = "non_commercial_dev_only"
	if err := ValidateCard(card); err == nil {
		t.Fatal("accepted noncommercial provider in public feed")
	}
}

func TestPreparePublishedCardPreservesVerifiedSourceExpiry(t *testing.T) {
	now := time.Date(2026, 10, 24, 11, 0, 0, 0, JST)
	card := DateCard(now)
	card.ID, card.Lesson.ID = "culture:time-test", "culture:time-test"
	card.Topic, card.Scene.Kind = "culture", "culture"
	card.Lesson.Source.ObservedAt = now.Add(-3 * time.Hour)
	card.Lesson.Source.FetchedAt = now.Add(-2 * time.Hour)
	card.Lesson.Source.ExpiresAt = now.Add(30 * time.Minute)
	published, err := PreparePublishedCard(card, now)
	if err != nil {
		t.Fatal(err)
	}
	if !published.Lesson.Source.FetchedAt.Equal(card.Lesson.Source.FetchedAt) || !published.Lesson.Source.ExpiresAt.Equal(card.Lesson.Source.ExpiresAt) {
		t.Fatal("publication rewrote source provenance or expiry")
	}
	card.Lesson.Source.ExpiresAt = now.Add(-time.Minute)
	if _, err := PreparePublishedCard(card, now); err == nil || !strings.Contains(err.Error(), "expired") {
		t.Fatalf("expired source was published: %v", err)
	}
	card.Lesson.Source.ExpiresAt = now.Add(48 * time.Hour)
	published, err = PreparePublishedCard(card, now)
	if err != nil || !published.Lesson.Source.ExpiresAt.Equal(EndOfDay(now)) {
		t.Fatalf("source exceeded JST end-of-day: %v %+v", err, published.Lesson.Source)
	}
	card.Lesson.Source.FetchedAt = now.Add(time.Hour)
	if _, err = PreparePublishedCard(card, now); err == nil {
		t.Fatal("future fetch was accepted")
	}
}
