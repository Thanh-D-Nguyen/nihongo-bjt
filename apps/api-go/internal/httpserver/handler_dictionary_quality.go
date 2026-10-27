package httpserver

import (
	"regexp"
	"strings"
)

var dictionaryDefinitionSubject = regexp.MustCompile(`(?i)^(?:từ(?: tiếng nhật)?\s+)?[『「]([^』」]+)[』」]\s*(?:とは|は|là|có nghĩa)`)

// dictionaryGlossUsable rejects recognizable import contamination, without rewriting canonical data.
func dictionaryGlossUsable(headword string, gloss *string) bool {
	if gloss == nil {
		return true
	}
	text := strings.Join(strings.Fields(strings.ToLower(*gloss)), " ")
	for _, refusal := range []string{
		"i cannot provide", "i can't provide", "i cannot translate", "i can't translate",
		"i am unable to translate", "i'm unable to translate", "as an ai",
		"không có thông tin đủ để dịch", "không có thông tin đầy đủ để dịch", "không đủ thông tin để dịch", "không có đủ thông tin để dịch", "tôi không thể dịch",
		"tôi không thể cung cấp bản dịch", "翻訳できません",
	} {
		if strings.Contains(text, refusal) {
			return false
		}
	}
	// A definition explicitly naming another headword is not a gloss for this entry.
	if subject := dictionaryDefinitionSubject.FindStringSubmatch(strings.TrimSpace(*gloss)); len(subject) > 1 {
		return strings.TrimSpace(subject[1]) == strings.Trim(strings.TrimSpace(headword), "。.!！?？")
	}
	return true
}
