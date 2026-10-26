package lifefeed

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// GeographyTemplate is the source scope and Japanese template approved by the operator.
const GeographyTemplate = "wikidata-geography-v1"

const geographyAttribution = "Geographic facts from Wikidata, CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Japanese learning material adapted by KotobaWorks; " + GeographyTemplate + "."

var geographyPlaces = []struct{ city, entity, english string }{
	{"tokyo", "Q1490", "Tokyo"}, {"yokohama", "Q38283", "Yokohama"},
	{"osaka", "Q35765", "Osaka"}, {"nagoya", "Q11751", "Nagoya"},
	{"kyoto", "Q34600", "Kyoto"}, {"sapporo", "Q37951", "Sapporo"},
	{"sendai", "Q46747", "Sendai"}, {"hiroshima", "Q34664", "Hiroshima"},
	{"fukuoka", "Q26600", "Fukuoka"}, {"naha", "Q181966", "Naha"},
}

type GeographyProvider struct {
	client   *http.Client
	agent    string
	endpoint string
	now      func() time.Time
}

func NewGeographyProvider(agent string) *GeographyProvider {
	return &GeographyProvider{
		client: &http.Client{Timeout: 20 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }},
		agent:  agent, endpoint: "https://www.wikidata.org/w/api.php", now: time.Now,
	}
}

// Fetch consumes only entity identity, Japanese label, revision, and Japan-country claims.
// Text, readings and exercises are fixed reviewed material, never copied from arbitrary wiki text.
func (p *GeographyProvider) Fetch(ctx context.Context) (map[string]Card, error) {
	if !strings.Contains(p.agent, "https://") && !strings.Contains(p.agent, "@") {
		return nil, fmt.Errorf("Wikidata requires an identifying operator contact")
	}
	ids := make([]string, 0, len(geographyPlaces))
	for _, place := range geographyPlaces {
		ids = append(ids, place.entity)
	}
	args := url.Values{"action": {"wbgetentities"}, "ids": {strings.Join(ids, "|")}, "props": {"info|labels|claims"}, "languages": {"ja"}, "format": {"json"}, "maxlag": {"5"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.endpoint+"?"+args.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("prepare Wikidata request: %w", err)
	}
	req.Header.Set("User-Agent", p.agent)
	req.Header.Set("Accept", "application/json")
	response, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch Wikidata: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Wikidata HTTP %d; stop this refresh (Retry-After: %q)", response.StatusCode, response.Header.Get("Retry-After"))
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, (4<<20)+1))
	if err != nil || len(raw) > 4<<20 {
		return nil, fmt.Errorf("invalid or oversized Wikidata response")
	}
	var snapshot struct {
		Entities map[string]struct {
			ID       string                            `json:"id"`
			Revision int64                             `json:"lastrevid"`
			Modified time.Time                         `json:"modified"`
			Labels   map[string]struct{ Value string } `json:"labels"`
			Claims   struct {
				Country []struct {
					Rank     string `json:"rank"`
					Mainsnak struct {
						Kind  string `json:"snaktype"`
						Value struct {
							Type string              `json:"type"`
							Data struct{ ID string } `json:"value"`
						} `json:"datavalue"`
					} `json:"mainsnak"`
				} `json:"P17"`
			} `json:"claims"`
		} `json:"entities"`
	}
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		return nil, fmt.Errorf("decode Wikidata: %w", err)
	}
	now := p.now().UTC()
	cards := make(map[string]Card, len(geographyPlaces))
	for _, place := range geographyPlaces {
		entity := snapshot.Entities[place.entity]
		label := weatherCities[place.city].Japanese + "市"
		if place.city == "tokyo" {
			label = "東京都"
		}
		if entity.ID != place.entity || entity.Revision <= 0 || entity.Modified.IsZero() || entity.Modified.After(now) || entity.Labels["ja"].Value != label {
			return nil, fmt.Errorf("unverified Wikidata identity/revision for %s", place.city)
		}
		verified := false
		for _, claim := range entity.Claims.Country {
			if claim.Rank == "deprecated" {
				continue
			}
			if claim.Mainsnak.Kind != "value" || claim.Mainsnak.Value.Type != "wikibase-entityid" || claim.Mainsnak.Value.Data.ID != "Q17" {
				return nil, fmt.Errorf("unverified Japan-country claim for %s", place.city)
			}
			verified = true
		}
		if !verified {
			return nil, fmt.Errorf("missing Japan-country claim for %s", place.city)
		}
		source := Source{
			ProviderName: "Wikidata CC0", URL: fmt.Sprintf("https://www.wikidata.org/w/index.php?title=%s&oldid=%d", place.entity, entity.Revision),
			AttributionText: geographyAttribution,
			LicenseStatus:   "commercial", ObservedAt: entity.Modified, FetchedAt: now, ExpiresAt: now.Add(48 * time.Hour), Freshness: "live",
		}
		card := geographyCard(place.city, place.english, source)
		if _, err := PreparePublishedCard(card, now); err != nil {
			return nil, fmt.Errorf("invalid geography lesson for %s: %w", place.city, err)
		}
		// Store the original 48-hour snapshot TTL; the reader caps client caching at JST midnight.
		cards[place.city] = card
	}
	return cards, nil
}

func geographyCard(city, english string, source Source) Card {
	place := weatherCities[city]
	id := "culture:" + city + ":" + source.FetchedAt.In(JST).Format("2006-01-02")
	japanese, reading := place.Japanese+"は日本にあります。", place.Kana+"はにほんにあります。"
	summary := Text{Vi: english + " nằm ở Nhật Bản.", En: english + " is in Japan."}
	return Card{ID: id, Topic: "culture", Provenance: "live", Summary: summary,
		Meta: Text{Vi: "Địa lý Nhật Bản · dữ kiện Wikidata", En: "Japan geography · Wikidata facts"}, Scene: Scene{Kind: "culture"},
		Lesson: Lesson{ID: id, Level: "N5", Title: Title{Japanese: place.Japanese + "はどこにありますか", Reading: place.Kana + "はどこにありますか", Vi: english + " nằm ở đâu?", En: "Where is " + english + "?"}, Source: source,
			Chips:      []Chip{{Text: Text{Vi: "Mẫu câu chỉ vị trí", En: "Expressing location"}}},
			Sentences:  []Sentence{{ID: "location", Basis: "fact", Japanese: japanese, Reading: reading, Translations: summary, Explanation: Text{Vi: "Mẫu A は B にあります chỉ nơi chốn. Dữ kiện được kiểm tra từ thuộc tính quốc gia của địa danh, không phải vị trí GPS của bạn.", En: "A は B にあります states a location. The place's country is checked against Wikidata; this is not your GPS location."}}},
			Vocabulary: []Vocabulary{{ID: "place", Japanese: place.Japanese, Reading: place.Kana, Meanings: Text{Vi: english, En: english}, ExampleJapanese: japanese}, {ID: "japan", Japanese: "日本", Reading: "にほん", Meanings: Text{Vi: "Nhật Bản", En: "Japan"}, ExampleJapanese: japanese}},
			Exercises: []Exercise{
				{ID: "recall", Kind: "recall_text", SkillType: "recall", PromptJapanese: "＿＿は日本にあります。", Prompt: Text{Vi: "Điền tên địa danh vừa học bằng kanji hoặc hiragana.", En: "Fill in the place just learned in kanji or hiragana."}, AcceptedAnswers: []string{place.Japanese, place.Kana}, Explanation: Text{Vi: "Đáp án: " + place.Japanese + "（" + place.Kana + "）", En: "Answer: " + place.Japanese + " (" + place.Kana + ")"}},
				{ID: "recognition", Kind: "choice", SkillType: "recognition", PromptJapanese: "日本", Prompt: Text{Vi: "Chọn cách đọc của 日本.", En: "Choose the reading of 日本."}, Choices: []Choice{{ID: "japan", Text: "にほん"}, {ID: "china", Text: "ちゅうごく"}}, CorrectChoiceID: "japan", Explanation: Text{Vi: "日本 đọc là にほん; cũng có cách đọc にっぽん.", En: "日本 is read にほん, also にっぽん."}},
			}, EstimatedMinutes: 2,
		},
	}
}
