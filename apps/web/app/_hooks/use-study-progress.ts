import { learnerApiFetch } from "../../lib/learner-api";

export function recordStudyProgress(taskType: "srs_review" | "bjt_quiz" | "daily_phrase" | "battle_bot") {
  learnerApiFetch("/api/gamification/study-plan/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskType }),
  }).catch(() => {}); // fire-and-forget
}
