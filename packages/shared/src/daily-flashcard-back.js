/** Dev / placeholder copy in daily `bodyMd` — not suitable as learner-facing flashcard back. */
const META_BODY_MD_PATTERN = /Fallback weather|seed nội bộ|RSS provider/i;
/** Vietnamese legal safeguard line stored in `explanationText` for some life-in-Japan widgets. */
const VI_LEGAL_SAFEGUARD_PATTERN = /Nội dung chỉ phục vụ học tiếng Nhật theo ngữ cảnh/;
function normFlashText(value) {
    return value.normalize("NFC").replace(/\r\n/g, "\n").trim();
}
/**
 * True when the learner-facing back is almost certainly only the Vietnamese compliance line
 * (legacy bug), not the full situational `bodyMd` + footnote.
 */
export function isLikelyVietnameseLegalDisclaimerOnlyBack(persistedBackText) {
    const t = normFlashText(persistedBackText);
    if (!VI_LEGAL_SAFEGUARD_PATTERN.test(t)) {
        return false;
    }
    if (/\bTình huống\b/u.test(t)) {
        return false;
    }
    if (/\bÝ câu\b/u.test(t)) {
        return false;
    }
    if (t.length > 520) {
        return false;
    }
    return true;
}
/**
 * Build flashcard `backText` for Daily Hub suggested cards so the back relates to the front:
 * - Prefer situational / learning `bodyMd`
 * - Append non-disclaimer `explanationText` when it adds coaching (not duplicate of body)
 * - Append disclaimer as a short footnote when present
 */
export function buildDailySuggestedFlashcardBack(bodyMd, explanationText) {
    const body = bodyMd.trim();
    const expl = explanationText.trim();
    const isMetaBody = META_BODY_MD_PATTERN.test(body);
    const main = isMetaBody ? expl : body;
    const hasLegalDisclaimer = VI_LEGAL_SAFEGUARD_PATTERN.test(expl);
    const learningExtra = !isMetaBody && expl.length > 0 && !hasLegalDisclaimer && expl !== body ? `\n\n${expl}` : "";
    const legal = !isMetaBody && hasLegalDisclaimer ? `\n\n— ${expl}` : "";
    return `${main}${learningExtra}${legal}`.trim();
}
/**
 * Detects legacy `FlashcardVariant` rows where `backText` was mistakenly set to the Vietnamese
 * legal safeguard line only (same as `explanationText`) and returns the proper learning back.
 * Otherwise returns `null`.
 */
export function repairDailyContentFlashcardBackIfNeeded(persistedBackText, bodyMd, explanationText) {
    const body = (bodyMd ?? "").trim();
    const explTrim = (explanationText ?? "").trim();
    if (body.length === 0 && explTrim.length === 0) {
        return null;
    }
    const canonical = buildDailySuggestedFlashcardBack(bodyMd ?? "", explanationText ?? "");
    if (normFlashText(canonical) === normFlashText(persistedBackText)) {
        return null;
    }
    const backN = normFlashText(persistedBackText);
    const strictDisclaimerOnly = explTrim.length > 0 &&
        normFlashText(explanationText ?? "") === backN &&
        VI_LEGAL_SAFEGUARD_PATTERN.test(explTrim);
    const looseDisclaimerOnly = isLikelyVietnameseLegalDisclaimerOnlyBack(persistedBackText) &&
        body.length > 0 &&
        VI_LEGAL_SAFEGUARD_PATTERN.test(explTrim);
    if (!strictDisclaimerOnly && !looseDisclaimerOnly) {
        return null;
    }
    return canonical;
}
