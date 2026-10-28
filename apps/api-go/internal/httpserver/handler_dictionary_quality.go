package httpserver

import (
	"regexp"
	"strings"
)

var (
	dictionaryDefinitionSubject = regexp.MustCompile(`(?i)^(?:từ(?: tiếng nhật)?\s+)?[『「]([^』」]+)[』」]\s*(?:とは|は|là|có nghĩa)`)
	dictionaryTrailingParenRe   = regexp.MustCompile(`[\s;；]*\)+$`)
	dictionaryBrokenTagRe       = regexp.MustCompile(`(?i)(?:^|[;；,]\s*)(?:nghĩa mỹ|nghĩa cổ|nghĩa bóng|ddịa chất|n|v|adj)\s*\)`)
)

// cleanDictionaryGloss strips trailing unmatched closing parentheses and empty sense separators.
func cleanDictionaryGloss(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	if strings.Count(s, ")") > strings.Count(s, "(") {
		s = strings.TrimSpace(dictionaryTrailingParenRe.ReplaceAllString(s, ""))
	}
	parts := strings.FieldsFunc(s, func(r rune) bool { return r == ';' || r == '；' })
	cleaned := make([]string, 0, len(parts))
	seen := make(map[string]bool, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if strings.Count(p, ")") > strings.Count(p, "(") {
			p = strings.TrimSpace(dictionaryTrailingParenRe.ReplaceAllString(p, ""))
		}
		if p == "" {
			continue
		}
		key := strings.ToLower(p)
		if seen[key] {
			continue
		}
		seen[key] = true
		cleaned = append(cleaned, p)
	}
	return strings.Join(cleaned, "; ")
}

// dictionaryGlossUsable rejects recognizable import contamination, LLM meta-commentary,
// and pivot-translation errors without rewriting canonical data.
func dictionaryGlossUsable(headword string, gloss *string) bool {
	if gloss == nil {
		return true
	}
	raw := strings.TrimSpace(*gloss)
	if raw == "" {
		return true
	}
	text := strings.Join(strings.Fields(strings.ToLower(raw)), " ")
	for _, refusal := range []string{
		"i cannot provide", "i can't provide", "i cannot translate", "i can't translate",
		"i am unable to translate", "i'm unable to translate", "as an ai",
		"i cannot determine", "i do not have domain-specific", "i am not sure about the context",
		"i need more context", "requires more context", "without more context", "please provide more context",
		"difficult to provide an accurate translation", "cannot provide an accurate translation",
		"does not have a clear meaning in vietnamese", "do not have a specific translation in vietnamese",
		"may not have a direct translation in vietnamese", "seems to be in japanese",
		"in the construction industry", "related to the construction industry",
		"specific to the construction industry", "in vietnamese is", "in vietnamese; it is translated",
		"in vietnamese can be translated",
		"không có thông tin đủ để dịch", "không có thông tin đầy đủ để dịch", "không đủ thông tin để dịch",
		"không có đủ thông tin để dịch", "không có thông tin đầy đủ về thuật ngữ",
		"tôi không thể dịch", "tôi không thể cung cấp bản dịch", "翻訳できません",
		"vui lòng cung cấp thêm thông tin", "vui lòng cung cấp thêm ngữ cảnh",
		"bạn có thể cung cấp thêm thông tin", "đối với ngành công nghiệp xây dựng",
		"trong ngành xây dựng có thể dịch", "được dịch sang tiếng việt là",
		"thiết khoái tử", "cây trị điên", "cây lê lư",
		"những tiền đồng có liên hệ", "chéo qua đính kèm",
		"ddịa chất",
	} {
		if strings.Contains(text, refusal) {
			return false
		}
	}
	if dictionaryBrokenTagRe.MatchString(raw) {
		return false
	}
	// Reject glosses with unmatched parentheses left by broken regex stripping.
	if strings.Count(raw, "(") != strings.Count(raw, ")") {
		return false
	}
	// A definition explicitly naming another headword is not a gloss for this entry.
	if subject := dictionaryDefinitionSubject.FindStringSubmatch(raw); len(subject) > 1 {
		return strings.TrimSpace(subject[1]) == strings.Trim(strings.TrimSpace(headword), "。.!！?？")
	}
	return true
}
