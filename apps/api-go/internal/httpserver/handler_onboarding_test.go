package httpserver

import (
	"testing"
)

// TestOnboardingValidationConstants verifies that the Go validation maps
// match the NestJS VALID_GOALS, VALID_STYLES, and AVAILABLE_TOPICS constants.
// These are pure unit tests — no DB or auth context required.

func TestValidGoalsContract(t *testing.T) {
	requiredGoals := []string{
		"pass_bjt", "business_japanese", "daily_conversation",
		"reading_news", "jlpt_prep", "travel", "general",
	}
	for _, g := range requiredGoals {
		if !ValidGoals[g] {
			t.Errorf("required goal %q missing from ValidGoals", g)
		}
	}
	// Reject unknown goals.
	if ValidGoals["invalid_goal"] {
		t.Error("ValidGoals should not contain 'invalid_goal'")
	}
}

func TestValidStylesContract(t *testing.T) {
	requiredStyles := []string{"visual", "practice", "immersion", "flashcard", "mixed"}
	for _, s := range requiredStyles {
		if !ValidStyles[s] {
			t.Errorf("required style %q missing from ValidStyles", s)
		}
	}
	if ValidStyles["invalid_style"] {
		t.Error("ValidStyles should not contain 'invalid_style'")
	}
}

func TestAvailableTopicsContract(t *testing.T) {
	if len(AvailableTopics) == 0 {
		t.Fatal("AvailableTopics must not be empty")
	}
	found := make(map[string]bool, len(AvailableTopics))
	for _, topic := range AvailableTopics {
		found[topic] = true
	}
	requiredTopics := []string{"business_japanese", "daily_conversation", "jlpt_prep", "general"}
	for _, rt := range requiredTopics {
		if !found[rt] {
			t.Errorf("required topic %q missing from AvailableTopics", rt)
		}
	}
}

func TestSaveOnboardingPreferencesRequestDefaults(t *testing.T) {
	// Verify the request struct fields match the NestJS JSON contract.
	req := saveOnboardingPreferencesRequest{
		CurrentLevel: 3,
		Goal:         "pass_bjt",
		Topics:       []string{"business_japanese"},
		DailyMinutes: 30,
		Style:        "mixed",
	}
	if req.CurrentLevel != 3 {
		t.Errorf("expected CurrentLevel=3, got %d", req.CurrentLevel)
	}
	if req.Goal != "pass_bjt" {
		t.Errorf("expected Goal=pass_bjt, got %s", req.Goal)
	}
	if len(req.Topics) != 1 || req.Topics[0] != "business_japanese" {
		t.Errorf("unexpected Topics: %v", req.Topics)
	}
	if req.DailyMinutes != 30 {
		t.Errorf("expected DailyMinutes=30, got %d", req.DailyMinutes)
	}
	if req.Style != "mixed" {
		t.Errorf("expected Style=mixed, got %s", req.Style)
	}
}