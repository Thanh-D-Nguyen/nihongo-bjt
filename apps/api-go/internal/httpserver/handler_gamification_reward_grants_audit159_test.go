package httpserver

import "testing"

func TestAudit159LoginBonusScheduleOnlyAdvertisesAppliedRewards(t *testing.T) {
	rewards := loginBonusSchedule(nil, 4)
	if len(rewards) != 7 {
		t.Fatalf("schedule length=%d, want 7", len(rewards))
	}
	for _, reward := range rewards {
		if reward.Type != "xp" {
			t.Fatalf("day %d advertises unapplied reward %q", reward.Day, reward.Type)
		}
	}
	if rewards[3].Value != "20" || rewards[6].Value != "50" {
		t.Fatalf("day 4/7 XP rewards=%s/%s, want 20/50", rewards[3].Value, rewards[6].Value)
	}
}
