package httpserver

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

var romajiKana = map[string]string{
	"a": "あ", "i": "い", "u": "う", "e": "え", "o": "お",
	"ka": "か", "ki": "き", "ku": "く", "ke": "け", "ko": "こ", "ga": "が", "gi": "ぎ", "gu": "ぐ", "ge": "げ", "go": "ご",
	"sa": "さ", "shi": "し", "si": "し", "su": "す", "se": "せ", "so": "そ", "za": "ざ", "ji": "じ", "zi": "じ", "zu": "ず", "ze": "ぜ", "zo": "ぞ",
	"ta": "た", "chi": "ち", "ti": "ち", "tsu": "つ", "tu": "つ", "te": "て", "to": "と", "da": "だ", "di": "ぢ", "du": "づ", "de": "で", "do": "ど",
	"na": "な", "ni": "に", "nu": "ぬ", "ne": "ね", "no": "の", "ha": "は", "hi": "ひ", "fu": "ふ", "hu": "ふ", "he": "へ", "ho": "ほ",
	"ba": "ば", "bi": "び", "bu": "ぶ", "be": "べ", "bo": "ぼ", "pa": "ぱ", "pi": "ぴ", "pu": "ぷ", "pe": "ぺ", "po": "ぽ",
	"ma": "ま", "mi": "み", "mu": "む", "me": "め", "mo": "も", "ya": "や", "yu": "ゆ", "yo": "よ", "ra": "ら", "ri": "り", "ru": "る", "re": "れ", "ro": "ろ", "wa": "わ", "wo": "を",
	"kya": "きゃ", "kyu": "きゅ", "kyo": "きょ", "gya": "ぎゃ", "gyu": "ぎゅ", "gyo": "ぎょ", "sha": "しゃ", "shu": "しゅ", "sho": "しょ", "sya": "しゃ", "syu": "しゅ", "syo": "しょ",
	"ja": "じゃ", "ju": "じゅ", "jo": "じょ", "jya": "じゃ", "jyu": "じゅ", "jyo": "じょ", "cha": "ちゃ", "chu": "ちゅ", "cho": "ちょ", "tya": "ちゃ", "tyu": "ちゅ", "tyo": "ちょ",
	"nya": "にゃ", "nyu": "にゅ", "nyo": "にょ", "hya": "ひゃ", "hyu": "ひゅ", "hyo": "ひょ", "bya": "びゃ", "byu": "びゅ", "byo": "びょ", "pya": "ぴゃ", "pyu": "ぴゅ", "pyo": "ぴょ", "mya": "みゃ", "myu": "みゅ", "myo": "みょ", "rya": "りゃ", "ryu": "りゅ", "ryo": "りょ",
}

func suggestionKana(input string) (string, string, string) {
	q := norm.NFKC.String(strings.ToLower(input))
	var hiragana strings.Builder
	remaining := ""
convert:
	for i := 0; i < len(q); {
		if q[i] >= 'a' && q[i] <= 'z' {
			if strings.HasPrefix(q[i:], "tch") {
				hiragana.WriteString("っ")
				i++
				continue
			}
			if q[i] == 'n' && (i+1 == len(q) || q[i+1] == '\'' || (q[i+1] != 'y' && !strings.ContainsRune("aiueo", rune(q[i+1])))) {
				hiragana.WriteString("ん")
				i++
				if i < len(q) && q[i] == '\'' {
					i++
				}
				continue
			}
			if i+1 < len(q) && q[i] == q[i+1] && !strings.ContainsRune("aeioun", rune(q[i])) {
				hiragana.WriteString("っ")
				i++
				continue
			}
			matched := false
			for n := min(3, len(q)-i); n > 0; n-- {
				if kana, ok := romajiKana[q[i:i+n]]; ok {
					hiragana.WriteString(kana)
					i += n
					matched = true
					break
				}
			}
			if matched {
				continue
			}
			for romaji := range romajiKana {
				if strings.HasPrefix(romaji, q[i:]) {
					remaining = q[i:]
					break convert
				}
			}
		}
		r, size := utf8.DecodeRuneInString(q[i:])
		if r >= 'ァ' && r <= 'ヶ' {
			r -= 'ァ' - 'ぁ'
		}
		hiragana.WriteRune(r)
		i += size
	}
	hira := hiragana.String()
	kata := strings.Map(func(r rune) rune {
		if r >= 'ぁ' && r <= 'ゖ' {
			return r + ('ァ' - 'ぁ')
		}
		return unicode.ToLower(r)
	}, hira)
	return hira, kata, remaining
}

func suggestionLongVowels(kata string) string {
	groups := []string{"アァカガサザタダナハバパマヤャラワ", "イィキギシジチヂニヒビピミリ", "ウゥクグスズツヅヌフブプムユュル", "エェケゲセゼテデネヘベペメレ", "オォコゴソゾトドノホボポモヨョロヲ"}
	vowels := []rune("アイウエオ")
	var result strings.Builder
	var previous rune
	for _, r := range kata {
		long := false
		for i, group := range groups {
			if strings.ContainsRune(group, previous) && (r == vowels[i] || (i == 4 && r == 'ウ')) {
				long = true
				break
			}
		}
		if long {
			result.WriteRune('ー')
		} else {
			result.WriteRune(r)
		}
		previous = r
	}
	return result.String()
}
