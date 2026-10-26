package lifefeed

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func geographyResponse(now time.Time) map[string]any {
	entities := map[string]any{}
	for _, place := range geographyPlaces {
		label := weatherCities[place.city].Japanese + "市"
		if place.city == "tokyo" {
			label = "東京都"
		}
		entities[place.entity] = map[string]any{
			"id": place.entity, "lastrevid": 12345, "modified": now.Add(-time.Hour).Format(time.RFC3339),
			"labels": map[string]any{"ja": map[string]string{"value": label}},
			"claims": map[string]any{"P18": []any{map[string]any{"mainsnak": map[string]any{"datavalue": map[string]any{"value": "unrelated image filename"}}}}, "P17": []any{map[string]any{
				"rank": "normal", "mainsnak": map[string]any{"snaktype": "value", "datavalue": map[string]any{
					"type": "wikibase-entityid", "value": map[string]string{"id": "Q17"},
				}},
			}}},
		}
	}
	return map[string]any{"entities": entities}
}

func TestWikidataLessonsRequireVerifiedJapanClaims(t *testing.T) {
	now := time.Date(2026, 10, 26, 23, 0, 0, 0, JST)
	body := geographyResponse(now)
	var requests int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if r.Header.Get("User-Agent") != "KotobaWorksLifeBot/1.0 https://example.test/contact" || r.URL.Query().Has("maxlag") {
			t.Error("missing identifying agent, or sent maxlag for a read-only request")
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(body)
	}))
	defer server.Close()
	p := NewGeographyProvider("KotobaWorksLifeBot/1.0 https://example.test/contact")
	p.endpoint, p.now = server.URL, func() time.Time { return now }
	cards, err := p.Fetch(context.Background())
	if err != nil || len(cards) != 10 || requests != 1 {
		t.Fatalf("want 10 verified city lessons in one request; cards=%d requests=%d err=%v", len(cards), requests, err)
	}
	card := cards["tokyo"]
	if card.Lesson.Sentences[0].Japanese != "東京は日本にあります。" || card.Lesson.Sentences[0].Reading != "とうきょうはにほんにあります。" {
		t.Fatalf("incorrect approved Japanese/reading: %+v", card.Lesson.Sentences)
	}
	source := card.Lesson.Source
	if source.LicenseStatus != "commercial" || source.ProviderName != "Wikidata CC0" || !strings.Contains(source.URL, "oldid=12345") || !source.ObservedAt.Equal(now.Add(-time.Hour)) || !source.FetchedAt.Equal(now) {
		t.Fatalf("missing accurate source/license/revision: %+v", source)
	}
	if !source.ExpiresAt.Equal(now.Add(48 * time.Hour)) {
		t.Fatal("stored snapshot must survive midnight and one missed daily refresh")
	}
	prepared, err := PreparePublishedCard(card, now.Add(2*time.Hour))
	if err != nil || !prepared.Lesson.Source.ExpiresAt.Equal(EndOfDay(now.Add(2*time.Hour))) {
		t.Fatalf("next-day read must enforce client expiry without expiring the stored snapshot: %v", err)
	}
	if _, err = PreparePublishedCard(card, source.ExpiresAt); err == nil {
		t.Fatal("expired geographic snapshot was served")
	}
	for city, card := range cards {
		if _, err := PreparePublishedCard(card, now); err != nil {
			t.Fatalf("invalid lesson for %s: %v", city, err)
		}
	}

	for _, failure := range []string{"country", "label", "future", "missing", "revision"} {
		t.Run(failure, func(t *testing.T) {
			body = geographyResponse(now)
			entity := body["entities"].(map[string]any)["Q1490"].(map[string]any)
			switch failure {
			case "country":
				claim := entity["claims"].(map[string]any)["P17"].([]any)[0].(map[string]any)
				claim["mainsnak"].(map[string]any)["datavalue"].(map[string]any)["value"] = map[string]string{"id": "Q30"}
			case "label":
				entity["labels"] = map[string]any{"ja": map[string]string{"value": "別の場所"}}
			case "future":
				entity["modified"] = now.Add(time.Hour).Format(time.RFC3339)
			case "missing":
				delete(body["entities"].(map[string]any), "Q1490")
			case "revision":
				entity["lastrevid"] = 0
			}
			if got, err := p.Fetch(context.Background()); err == nil || len(got) != 0 {
				t.Fatalf("unverified snapshot produced publishable lessons: %d, %v", len(got), err)
			}
		})
	}
}

func TestWikidataFailureDoesNotProduceFallbackFacts(t *testing.T) {
	for _, status := range []int{http.StatusTooManyRequests, http.StatusServiceUnavailable} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				w.Header().Set("Retry-After", "60")
				w.WriteHeader(status)
			}))
			defer server.Close()
			p := NewGeographyProvider("KotobaWorksLifeBot/1.0 https://example.test/contact")
			p.endpoint = server.URL
			if got, err := p.Fetch(context.Background()); err == nil || len(got) != 0 || calls != 1 {
				t.Fatalf("upstream failure must stop without retry storms or fabricated facts: got=%d calls=%d err=%v", len(got), calls, err)
			}
		})
	}
	if _, err := NewGeographyProvider("").Fetch(context.Background()); err == nil {
		t.Fatal("anonymous upstream requests must be disabled")
	}
}

// Production incident 2026-10-26: Wikidata counted query-service (WDQS) lag toward maxlag and answered HTTP 200
// with an error object, which surfaced as the misleading "unverified Wikidata identity/revision".
func TestWikidataFetchIgnoresQueryServiceLagAndReportsAPIErrors(t *testing.T) {
	now := time.Date(2026, 10, 26, 23, 0, 0, 0, JST)
	var lagged bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Query().Has("maxlag") {
			lagged = true
			_, _ = w.Write([]byte(`{"error":{"code":"maxlag","info":"Waiting for wdqs1013: 7.5 seconds lagged.","type":"wikibase-queryservice"}}`))
			return
		}
		_ = json.NewEncoder(w).Encode(geographyResponse(now))
	}))
	defer server.Close()
	p := NewGeographyProvider("KotobaWorksLifeBot/1.0 https://example.test/contact")
	p.endpoint, p.now = server.URL, func() time.Time { return now }
	if cards, err := p.Fetch(context.Background()); lagged || err != nil || len(cards) != 10 {
		t.Fatalf("read-only fetch must not send maxlag and must verify 10 cities; lagged=%v cards=%d err=%v", lagged, len(cards), err)
	}

	apiError := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error":{"code":"readonly","info":"The wiki is currently in read-only mode."}}`))
	}))
	defer apiError.Close()
	p.endpoint = apiError.URL
	_, err := p.Fetch(context.Background())
	if err == nil || !strings.Contains(err.Error(), `Wikidata API error "readonly"`) || !strings.Contains(err.Error(), "read-only mode") {
		t.Fatalf("an API error body must be reported explicitly with its code and info; got %v", err)
	}
}
