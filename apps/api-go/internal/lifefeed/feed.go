// Package lifefeed validates editorial learning cards and renders the public Today feed.
package lifefeed

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

var JST = time.FixedZone("JST", 9*60*60)
var Cities = map[string]bool{"tokyo": true, "yokohama": true, "osaka": true, "nagoya": true, "kyoto": true, "sapporo": true, "sendai": true, "hiroshima": true, "fukuoka": true, "naha": true}
var Topics = map[string]bool{"date": true, "weather": true, "transit": true, "shopping": true, "news": true, "food": true, "culture": true, "money": true, "lottery": true}

type Text struct {
	Vi string `json:"vi"`
	En string `json:"en"`
}
type Title struct {
	Japanese string `json:"japanese"`
	Reading  string `json:"reading"`
	Vi       string `json:"vi"`
	En       string `json:"en"`
}
type Scene struct {
	Kind         string   `json:"kind"`
	Day          int      `json:"day,omitempty"`
	Weekday      string   `json:"weekday,omitempty"`
	WeatherCode  *int     `json:"weatherCode,omitempty"`
	TemperatureC *float64 `json:"temperatureC,omitempty"`
}
type Source struct {
	ProviderName    string    `json:"providerName"`
	URL             string    `json:"url,omitempty"`
	AttributionText string    `json:"attributionText,omitempty"`
	LicenseStatus   string    `json:"licenseStatus"`
	ObservedAt      time.Time `json:"observedAt"`
	FetchedAt       time.Time `json:"fetchedAt"`
	ExpiresAt       time.Time `json:"expiresAt"`
	Freshness       string    `json:"freshness"`
}
type Chip struct {
	Symbol string `json:"symbol,omitempty"`
	Text   Text   `json:"text"`
}
type Sentence struct {
	ID           string `json:"id"`
	Basis        string `json:"basis"`
	Japanese     string `json:"japanese"`
	Reading      string `json:"reading"`
	Translations Text   `json:"translations"`
	Explanation  Text   `json:"explanation"`
}
type Vocabulary struct {
	ID              string `json:"id"`
	Japanese        string `json:"japanese"`
	Reading         string `json:"reading"`
	Meanings        Text   `json:"meanings"`
	ExampleJapanese string `json:"exampleJapanese"`
}
type Choice struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}
type Exercise struct {
	ID              string   `json:"id"`
	Kind            string   `json:"kind"`
	SkillType       string   `json:"skillType"`
	PromptJapanese  string   `json:"promptJapanese"`
	Prompt          Text     `json:"prompt"`
	AcceptedAnswers []string `json:"acceptedAnswers,omitempty"`
	Choices         []Choice `json:"choices,omitempty"`
	CorrectChoiceID string   `json:"correctChoiceId,omitempty"`
	Explanation     Text     `json:"explanation"`
}
type Lesson struct {
	ID               string       `json:"id"`
	Level            string       `json:"level"`
	Title            Title        `json:"title"`
	Source           Source       `json:"source"`
	Chips            []Chip       `json:"chips"`
	Sentences        []Sentence   `json:"sentences"`
	Vocabulary       []Vocabulary `json:"vocabulary"`
	Exercises        []Exercise   `json:"exercises"`
	EstimatedMinutes int          `json:"estimatedMinutes"`
}
type Card struct {
	ID         string `json:"id"`
	Topic      string `json:"topic"`
	Provenance string `json:"provenance"`
	Summary    Text   `json:"summary"`
	Meta       Text   `json:"meta"`
	Scene      Scene  `json:"scene"`
	Lesson     Lesson `json:"lesson"`
}
type Feed struct {
	SchemaVersion int       `json:"schemaVersion"`
	GeneratedAt   time.Time `json:"generatedAt"`
	CityID        string    `json:"cityId"`
	Cards         []Card    `json:"cards"`
}

func required(text string) bool { return strings.TrimSpace(text) != "" }
func validText(t Text) bool     { return required(t.Vi) && required(t.En) }
func uniqueID(seen map[string]bool, id string) bool {
	if !required(id) || seen[id] {
		return false
	}
	seen[id] = true
	return true
}

// ValidateCard enforces the Swift mapper contract on both write and read boundaries.
func ValidateCard(card Card) error {
	if !required(card.ID) || len(card.ID) > 180 || !Topics[card.Topic] || card.Topic == "date" || card.Provenance != "live" && card.Provenance != "sample" || !validText(card.Summary) || !validText(card.Meta) {
		return errors.New("invalid card identity, topic or locale")
	}
	if card.Scene.Kind != card.Topic {
		return errors.New("scene kind does not match topic")
	}
	if card.Topic == "weather" && (card.Scene.WeatherCode == nil || *card.Scene.WeatherCode < 0 || *card.Scene.WeatherCode > 99) {
		return errors.New("weather code is required")
	}
	l := card.Lesson
	if !required(l.ID) || l.ID != card.ID || !required(l.Level) || !required(l.Title.Japanese) || !required(l.Title.Reading) || !required(l.Title.Vi) || !required(l.Title.En) || l.EstimatedMinutes < 1 || l.EstimatedMinutes > 30 {
		return errors.New("invalid lesson metadata")
	}
	s := l.Source
	if !required(s.ProviderName) || s.Freshness != "live" || (s.LicenseStatus != "commercial" && s.LicenseStatus != "not_applicable") || s.ObservedAt.IsZero() || s.FetchedAt.IsZero() || s.ExpiresAt.IsZero() {
		return errors.New("invalid source metadata or license")
	}
	if s.URL != "" {
		u, err := url.Parse(s.URL)
		if err != nil || u.Scheme != "https" || u.Host == "" || !required(s.AttributionText) {
			return errors.New("source requires https and attribution")
		}
	}
	if len(l.Sentences) < 1 || len(l.Vocabulary) < 1 || len(l.Exercises) < 1 || len(l.Sentences) > 12 || len(l.Vocabulary) > 25 || len(l.Exercises) > 12 {
		return errors.New("invalid lesson item counts")
	}
	seen := map[string]bool{}
	for _, v := range l.Sentences {
		if !uniqueID(seen, v.ID) || v.Basis != "fact" && v.Basis != "advice" || !required(v.Japanese) || !required(v.Reading) || !validText(v.Translations) || !validText(v.Explanation) {
			return errors.New("invalid sentence")
		}
	}
	seen = map[string]bool{}
	for _, v := range l.Vocabulary {
		if !uniqueID(seen, v.ID) || !required(v.Japanese) || !required(v.Reading) || !validText(v.Meanings) || !required(v.ExampleJapanese) {
			return errors.New("invalid vocabulary")
		}
	}
	seen = map[string]bool{}
	for _, v := range l.Exercises {
		if !uniqueID(seen, v.ID) || !required(v.PromptJapanese) || !validText(v.Prompt) || !validText(v.Explanation) {
			return errors.New("invalid exercise")
		}
		switch v.Kind {
		case "recall_text":
			if v.SkillType != "recall" || len(v.AcceptedAnswers) == 0 {
				return errors.New("recall requires answers")
			}
			for _, answer := range v.AcceptedAnswers {
				if !required(answer) || strings.Contains(strings.ToLower(v.PromptJapanese), strings.ToLower(answer)) {
					return errors.New("recall prompt reveals answer")
				}
			}
		case "choice":
			if v.SkillType != "recognition" || len(v.Choices) < 2 || !required(v.CorrectChoiceID) {
				return errors.New("invalid choice exercise")
			}
			ids := map[string]bool{}
			texts := map[string]bool{}
			for _, choice := range v.Choices {
				if !uniqueID(ids, choice.ID) || !required(choice.Text) || texts[choice.Text] {
					return errors.New("duplicate choice")
				}
				texts[choice.Text] = true
			}
			if !ids[v.CorrectChoiceID] {
				return errors.New("unknown correct choice")
			}
		default:
			return errors.New("unsupported exercise kind")
		}
	}
	// These topics are strictly educational. Reject predictive/solicitation language on publication.
	if card.Topic == "money" || card.Topic == "lottery" {
		blob := fmt.Sprintf("%+v", card)
		for _, term := range []string{"必勝", "予想番号", "購入を推奨", "買うべき", "guaranteed win", "buy now", "chắc chắn trúng", "nên mua", "dự đoán kết quả"} {
			if strings.Contains(strings.ToLower(blob), strings.ToLower(term)) {
				return fmt.Errorf("prohibited financial/gambling advice: %s", term)
			}
		}
	}
	return nil
}

func EndOfDay(t time.Time) time.Time {
	d := t.In(JST)
	return time.Date(d.Year(), d.Month(), d.Day(), 23, 59, 59, 0, JST)
}

// PreparePublishedCard enforces today's expiry regardless of the editor's saved TTL.
func PreparePublishedCard(card Card, now time.Time) (Card, error) {
	if err := ValidateCard(card); err != nil {
		return Card{}, err
	}
	s := card.Lesson.Source
	if s.ObservedAt.After(s.FetchedAt) || s.FetchedAt.After(now.Add(time.Minute)) {
		return Card{}, errors.New("invalid observation or fetch time")
	}
	if !s.ExpiresAt.After(now) {
		return Card{}, errors.New("source has expired")
	}
	if s.ExpiresAt.After(EndOfDay(now)) {
		card.Lesson.Source.ExpiresAt = EndOfDay(now)
	}
	return card, nil
}
