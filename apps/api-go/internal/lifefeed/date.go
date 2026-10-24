package lifefeed

import (
	"embed"
	"encoding/csv"
	"fmt"
	"strings"
	"time"
)

// Data: Cabinet Office, https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv
// Source terms: https://www.cao.go.jp/notice/rule.html (commercial reuse with attribution and adaptation notice).
// Snapshot contains only 2026-2027 dates; do not infer future holidays.
//
//go:embed holidays.csv
var holidayFiles embed.FS

var holidayNames = readHolidays()

func readHolidays() map[string]string {
	body, err := holidayFiles.ReadFile("holidays.csv")
	if err != nil {
		panic(err)
	}
	rows, err := csv.NewReader(strings.NewReader(string(body))).ReadAll()
	if err != nil {
		panic(err)
	}
	holidays := make(map[string]string, len(rows))
	for _, row := range rows {
		if len(row) != 2 {
			panic("invalid government holiday csv")
		}
		day, err := time.ParseInLocation("2006/1/2", row[0], JST)
		if err != nil {
			panic(err)
		}
		holidays[day.Format("2006-01-02")] = row[1]
	}
	return holidays
}

var weekdays = []struct{ Kanji, Reading, Vi, En string }{
	{"日", "にち", "Chủ nhật", "Sunday"}, {"月", "げつ", "thứ Hai", "Monday"}, {"火", "か", "thứ Ba", "Tuesday"}, {"水", "すい", "thứ Tư", "Wednesday"}, {"木", "もく", "thứ Năm", "Thursday"}, {"金", "きん", "thứ Sáu", "Friday"}, {"土", "ど", "thứ Bảy", "Saturday"},
}

// DateCard uses Japan calendar arithmetic, with a checked government holiday snapshot.
func DateCard(now time.Time) Card {
	day := now.In(JST)
	date := day.Format("2006-01-02")
	wk := weekdays[int(day.Weekday())]
	holiday, hasHoliday := holidayNames[date]
	word, reading, meaningVi, meaningEn := ""+wk.Kanji+"曜日", wk.Reading+"ようび", wk.Vi, wk.En
	source := Source{ProviderName: "Japan calendar (JST)", LicenseStatus: "not_applicable", ObservedAt: day, FetchedAt: day, ExpiresAt: EndOfDay(day), Freshness: "live"}
	if hasHoliday {
		word, reading, meaningVi, meaningEn = "祝日", "しゅくじつ", "ngày lễ", "public holiday"
		source.ProviderName = "Cabinet Office (Japan)"
		source.URL = "https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html"
		source.AttributionText = "Source: Cabinet Office holiday dataset (Japan), adapted into a Japanese language lesson"
		source.LicenseStatus = "commercial"
	}
	textJa := "今日は" + word + "です。"
	textReading := "きょうは" + reading + "です。"
	summary := Text{Vi: fmt.Sprintf("Hôm nay là %s.", wk.Vi), En: fmt.Sprintf("Today is %s.", wk.En)}
	if hasHoliday {
		summary = Text{Vi: fmt.Sprintf("Hôm nay là ngày lễ (%s).", holiday), En: fmt.Sprintf("Today is a public holiday (%s).", holiday)}
	}
	id := "date:" + date
	return Card{ID: id, Topic: "date", Provenance: "live", Summary: summary, Meta: Text{Vi: source.ProviderName, En: source.ProviderName}, Scene: Scene{Kind: "date", Day: day.Day(), Weekday: wk.Kanji}, Lesson: Lesson{
		ID: id, Level: "N5", Title: Title{Japanese: strings.TrimSuffix(textJa, "。"), Reading: strings.TrimSuffix(textReading, "。"), Vi: summary.Vi, En: summary.En}, Source: source,
		Chips:      []Chip{{Symbol: "calendar", Text: Text{Vi: meaningVi, En: meaningEn}}},
		Sentences:  []Sentence{{ID: "s1", Basis: "fact", Japanese: textJa, Reading: textReading, Translations: summary, Explanation: Text{Vi: "今日は nghĩa là hôm nay; です kết thúc câu lịch sự.", En: "今日は means today; です ends a polite sentence."}}},
		Vocabulary: []Vocabulary{{ID: "date:" + word, Japanese: word, Reading: reading, Meanings: Text{Vi: meaningVi, En: meaningEn}, ExampleJapanese: textJa}},
		Exercises:  []Exercise{{ID: "r", Kind: "recall_text", SkillType: "recall", PromptJapanese: "今日は＿＿です。", Prompt: Text{Vi: "Điền tên ngày bằng tiếng Nhật.", En: "Fill in the Japanese day expression."}, AcceptedAnswers: []string{word, reading}, Explanation: Text{Vi: "Đáp án: " + word, En: "Answer: " + word}}, {ID: "c", Kind: "choice", SkillType: "recognition", PromptJapanese: word, Prompt: Text{Vi: "Chọn cách đọc đúng.", En: "Choose the correct reading."}, Choices: []Choice{{ID: "a", Text: reading}, {ID: "b", Text: "きょう"}}, CorrectChoiceID: "a", Explanation: Text{Vi: "Cách đọc: " + reading, En: "Reading: " + reading}}}, EstimatedMinutes: 2,
	}}
}
