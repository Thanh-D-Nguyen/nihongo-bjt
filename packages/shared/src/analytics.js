export function toUtcDateKey(date) {
    return date.toISOString().slice(0, 10);
}
export function percentage(numerator, denominator) {
    if (denominator <= 0) {
        return 0;
    }
    return Math.round((numerator / denominator) * 1000) / 10;
}
export function coachingInsight(input, locale) {
    const l = locale === "ja" ? "ja" : locale === "vi" ? "vi" : "en";
    if (input.reviewCount === 0) {
        return l === "vi"
            ? "Hãy bắt đầu bằng một bộ ôn tập nhỏ để tạo đà cho chuỗi ngày học."
            : l === "ja"
                ? "今日は少しだけ復習して、学習の流れを作りましょう。"
                : "Start with a small review set today so the streak has a clear anchor.";
    }
    if (input.bjtAccuracyPct > 0 && input.bjtAccuracyPct < 60) {
        return l === "vi"
            ? "Độ chính xác đang hình thành — hãy ôn lại các câu sai trước, rồi thử một bài BJT ngắn."
            : l === "ja"
                ? "正確さはまだ定着中です。間違えた問題を復習してから、短いBJT演習を試しましょう。"
                : "Accuracy is still forming; review missed items first, then try a short BJT sprint.";
    }
    if (input.streakDays >= 7) {
        return l === "vi"
            ? "Nhịp học hàng tuần rất tốt — hãy giữ buổi tiếp theo ngắn và đều đặn."
            : l === "ja"
                ? "毎週のリズムが安定しています。次のセッションは短く、着実に続けましょう。"
                : "Your weekly rhythm is strong; keep the next session short and consistent.";
    }
    return l === "vi"
        ? "Tiến bộ đang diễn ra — một buổi ôn tập tập trung và một câu hỏi luyện tập là đủ cho hôm nay."
        : l === "ja"
            ? "学習は順調です。今日は集中して復習と1問の練習で十分です。"
            : "Progress is moving; one focused review and one practice question is enough today.";
}
