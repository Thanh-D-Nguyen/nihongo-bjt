// Package magazine publishes the daily magazine articles from curated content
// pools, rotating through each pool so consecutive days never show the same
// article while an unused one exists.
package magazine

import (
	"embed"
	"encoding/json"
	"fmt"
	"time"
)

// Widget kinds with a content pool.
const (
	KindVocab     = "magazine_vocab"
	KindWeather   = "magazine_weather"
	KindBJTPhrase = "magazine_bjt_phrase"
)

// ScheduledKinds lists the kinds the daily job publishes, in publish order.
// Weather, horoscope and loto are deliberately absent: the weather pool has
// two seasonal entries (rainy season, midsummer) and no season logic, so
// publishing it daily would show them out of season; horoscope has no pool;
// loto is owned by the loto hub. Add KindWeather once a seasonal pool exists.
var ScheduledKinds = []string{KindVocab, KindBJTPhrase}

//go:embed pool/*.json
var poolFS embed.FS

var poolFiles = map[string]string{
	KindVocab:     "pool/vocab.json",
	KindWeather:   "pool/weather.json",
	KindBJTPhrase: "pool/bjt_phrase.json",
}

// VocabItem is one vocabulary row attached to an article.
type VocabItem struct {
	WordJp       string `json:"wordJp"`
	Reading      string `json:"reading"`
	MeaningVi    string `json:"meaningVi"`
	Pos          string `json:"pos"`
	JLPTLevel    string `json:"jlptLevel"`
	SentenceJp   string `json:"sentenceJp"`
	SentenceVi   string `json:"sentenceVi"`
	DisplayOrder int    `json:"displayOrder"`
}

// Quiz is one quiz question attached to an article.
type Quiz struct {
	QuestionJp    string   `json:"questionJp"`
	QuestionVi    string   `json:"questionVi"`
	QuizType      string   `json:"quizType"`
	Options       []string `json:"options"`
	CorrectAnswer string   `json:"correctAnswer"`
	ExplanationJp string   `json:"explanationJp"`
	ExplanationVi string   `json:"explanationVi"`
	DisplayOrder  int      `json:"displayOrder"`
}

// Entry is one curated article template. Key is the stable identity used to
// remember what was already published; never change or reuse a key.
type Entry struct {
	Key         string          `json:"key"`
	TitleJp     string          `json:"titleJp"`
	TitleVi     string          `json:"titleVi"`
	SummaryJp   string          `json:"summaryJp"`
	SummaryVi   string          `json:"summaryVi"`
	ContentJSON json.RawMessage `json:"contentJson"`
	JLPTLevel   string          `json:"jlptLevel"`
	VocabItems  []VocabItem     `json:"vocabItems"`
	Quizzes     []Quiz          `json:"quizzes"`
}

// LoadPools decodes the embedded content pools keyed by widget kind.
func LoadPools() (map[string][]Entry, error) {
	pools := make(map[string][]Entry, len(poolFiles))
	for kind, file := range poolFiles { // includes pools not (yet) scheduled
		raw, err := poolFS.ReadFile(file)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", file, err)
		}
		var entries []Entry
		if err := json.Unmarshal(raw, &entries); err != nil {
			return nil, fmt.Errorf("decode %s: %w", file, err)
		}
		pools[kind] = entries
	}
	return pools, nil
}

// ShouldGenerate reports whether kind is published on the given date.
// BJT phrases are a weekday feature; the other kinds are daily.
func ShouldGenerate(kind string, date time.Time) bool {
	if kind == KindBJTPhrase {
		wd := date.Weekday()
		return wd != time.Saturday && wd != time.Sunday
	}
	return true
}
