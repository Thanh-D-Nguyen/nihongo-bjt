package lifefeed

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Locationforecast 2.0 is CC BY 4.0 and free for commercial use.
// Terms: https://api.met.no/doc/TermsOfService — identify the caller and honor Expires.
const metWeatherURL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"

var weatherCities = map[string]struct {
	Lat, Lon       float64
	Japanese, Kana string
}{
	"tokyo":     {35.6762, 139.6503, "東京", "とうきょう"},
	"yokohama":  {35.4437, 139.6380, "横浜", "よこはま"},
	"osaka":     {34.6937, 135.5023, "大阪", "おおさか"},
	"nagoya":    {35.1815, 136.9066, "名古屋", "なごや"},
	"kyoto":     {35.0116, 135.7681, "京都", "きょうと"},
	"sapporo":   {43.0618, 141.3545, "札幌", "さっぽろ"},
	"sendai":    {38.2682, 140.8694, "仙台", "せんだい"},
	"hiroshima": {34.3853, 132.4553, "広島", "ひろしま"},
	"fukuoka":   {33.5902, 130.4017, "福岡", "ふくおか"},
	"naha":      {26.2124, 127.6792, "那覇", "なは"},
}

type metCache struct {
	body         []byte
	lastModified string
	expires      time.Time
	fetchedAt    time.Time
}

type cityWeatherCache struct {
	mu    sync.Mutex
	entry metCache
}

type WeatherProvider struct {
	client    *http.Client
	userAgent string
	endpoint  string
	cache     map[string]*cityWeatherCache
}

// Configure MET_NORWAY_USER_AGENT with a product name and publicly reachable
// contact URL/email. The provider is disabled until valid operator identity exists.
func NewWeatherProvider(agent string) *WeatherProvider {
	if !strings.Contains(agent, "@") && !strings.Contains(agent, "https://") {
		agent = ""
	}
	cache := make(map[string]*cityWeatherCache, len(weatherCities))
	for city := range weatherCities {
		cache[city] = &cityWeatherCache{}
	}
	return &WeatherProvider{client: &http.Client{Timeout: 4 * time.Second}, userAgent: agent, endpoint: metWeatherURL, cache: cache}
}

func (p *WeatherProvider) Enabled() bool { return p != nil && p.userAgent != "" }

func (p *WeatherProvider) Forecast(ctx context.Context, city string, now time.Time) (Card, error) {
	place, ok := weatherCities[city]
	if !ok || p == nil || p.userAgent == "" {
		return Card{}, fmt.Errorf("weather provider is not configured")
	}
	cityCache := p.cache[city]
	cityCache.mu.Lock()
	defer cityCache.mu.Unlock()
	entry := cityCache.entry
	if !entry.expires.After(now) {
		uri := fmt.Sprintf("%s?lat=%.4f&lon=%.4f", p.endpoint, place.Lat, place.Lon)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, uri, nil)
		if err != nil {
			return Card{}, err
		}
		req.Header.Set("User-Agent", p.userAgent)
		if entry.lastModified != "" {
			req.Header.Set("If-Modified-Since", entry.lastModified)
		}
		response, err := p.client.Do(req)
		if err != nil {
			return Card{}, err
		}
		defer response.Body.Close()
		expires, err := http.ParseTime(response.Header.Get("Expires"))
		if err != nil || !expires.After(now) {
			return Card{}, fmt.Errorf("MET Norway provided no valid Expires header")
		}
		switch response.StatusCode {
		case http.StatusOK:
			body, readErr := io.ReadAll(io.LimitReader(response.Body, 2<<20))
			if readErr != nil || len(body) == 2<<20 {
				return Card{}, fmt.Errorf("invalid or oversized MET Norway response")
			}
			entry.body = body
			entry.lastModified = response.Header.Get("Last-Modified")
			entry.fetchedAt = now
		case http.StatusNotModified:
			if len(entry.body) == 0 {
				return Card{}, fmt.Errorf("MET Norway returned 304 without cached data")
			}
		default:
			return Card{}, fmt.Errorf("MET Norway HTTP status %d", response.StatusCode)
		}
		entry.expires = expires
		cityCache.entry = entry
	}
	return weatherCard(entry.body, city, now, entry.fetchedAt, entry.expires)
}

func weatherCard(raw []byte, city string, now, fetchedAt, expires time.Time) (Card, error) {
	var forecast struct {
		Properties struct {
			Meta struct {
				UpdatedAt time.Time `json:"updated_at"`
			} `json:"meta"`
			Timeseries []struct {
				Time time.Time `json:"time"`
				Data struct {
					Instant struct {
						Details struct {
							AirTemperature float64 `json:"air_temperature"`
						} `json:"details"`
					} `json:"instant"`
					Next1 struct {
						Summary struct {
							SymbolCode string `json:"symbol_code"`
						} `json:"summary"`
					} `json:"next_1_hours"`
				} `json:"data"`
			} `json:"timeseries"`
		} `json:"properties"`
	}
	if err := json.Unmarshal(raw, &forecast); err != nil {
		return Card{}, err
	}
	var symbol string
	var temperature float64
	for _, point := range forecast.Properties.Timeseries {
		if !point.Time.Before(now.Add(-time.Hour)) && !point.Time.After(now.Add(2*time.Hour)) && point.Data.Next1.Summary.SymbolCode != "" {
			symbol = point.Data.Next1.Summary.SymbolCode
			temperature = point.Data.Instant.Details.AirTemperature
			break
		}
	}
	code, word, reading, vi, en, ok := weatherCondition(symbol)
	if !ok || forecast.Properties.Meta.UpdatedAt.IsZero() || forecast.Properties.Meta.UpdatedAt.After(now.Add(time.Minute)) {
		return Card{}, fmt.Errorf("MET Norway forecast missing current weather or update time")
	}
	place := weatherCities[city]
	date := now.In(JST).Format("2006-01-02")
	id := "weather:" + city + ":" + date
	sentence := "今日の天気予報は" + word + "です。"
	spoken := "きょうのてんきよほうは" + reading + "です。"
	summary := Text{Vi: fmt.Sprintf("Dự báo %s: %s, %.0f°C.", place.Japanese, vi, temperature), En: fmt.Sprintf("Forecast for %s: %s, %.0f°C.", place.Japanese, en, temperature)}
	url := fmt.Sprintf("%s?lat=%.4f&lon=%.4f", metWeatherURL, place.Lat, place.Lon)
	card := Card{ID: id, Topic: "weather", Provenance: "live", Summary: summary, Meta: Text{Vi: "Dự báo từ MET Norway", En: "Forecast by MET Norway"}, Scene: Scene{Kind: "weather", WeatherCode: &code, TemperatureC: &temperature}, Lesson: Lesson{
		ID: id, Level: "N5", Title: Title{Japanese: place.Japanese + "の天気予報", Reading: place.Kana + "のてんきよほう", Vi: "Dự báo thời tiết", En: "Weather forecast"},
		Source:           Source{ProviderName: "MET Norway", URL: url, AttributionText: "Based on forecast data from the Norwegian Meteorological Institute (MET Norway), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Japanese learning material adapted by KotobaWorks.", LicenseStatus: "commercial", ObservedAt: forecast.Properties.Meta.UpdatedAt, FetchedAt: fetchedAt, ExpiresAt: expires, Freshness: "live"},
		Chips:            []Chip{{Symbol: "weather", Text: Text{Vi: vi, En: en}}},
		Sentences:        []Sentence{{ID: "w1", Basis: "fact", Japanese: sentence, Reading: spoken, Translations: Text{Vi: "Dự báo thời tiết hôm nay là " + vi + ".", En: "Today's forecast is " + en + "."}, Explanation: Text{Vi: "天気予報 nghĩa là dự báo thời tiết, không phải quan sát hiện tại.", En: "天気予報 means forecast, not a current observation."}}},
		Vocabulary:       []Vocabulary{{ID: "weather:" + word, Japanese: word, Reading: reading, Meanings: Text{Vi: vi, En: en}, ExampleJapanese: sentence}},
		Exercises:        []Exercise{{ID: "w-recall", Kind: "recall_text", SkillType: "recall", PromptJapanese: "今日の天気予報は＿＿です。", Prompt: Text{Vi: "Điền từ chỉ thời tiết.", En: "Fill in the weather word."}, AcceptedAnswers: []string{word, reading}, Explanation: Text{Vi: "Đáp án: " + word, En: "Answer: " + word}}, {ID: "w-choice", Kind: "choice", SkillType: "recognition", PromptJapanese: word, Prompt: Text{Vi: "Chọn cách đọc.", En: "Choose the reading."}, Choices: []Choice{{ID: "a", Text: reading}, {ID: "b", Text: "よほう"}}, CorrectChoiceID: "a", Explanation: Text{Vi: "Cách đọc: " + reading, En: "Reading: " + reading}}},
		EstimatedMinutes: 2,
	}}
	if reading == "よほう" {
		card.Lesson.Exercises[1].Choices[1].Text = "きょう"
	}
	return PreparePublishedCard(card, now)
}

func weatherCondition(symbol string) (int, string, string, string, string, bool) {
	switch {
	case strings.Contains(symbol, "thunder"):
		return 95, "雷雨", "らいう", "mưa dông", "thunderstorm", true
	case strings.Contains(symbol, "sleet"):
		return 71, "みぞれ", "みぞれ", "mưa tuyết", "sleet", true
	case strings.Contains(symbol, "snow"):
		return 71, "雪", "ゆき", "tuyết", "snow", true
	case strings.Contains(symbol, "rain"):
		return 61, "雨", "あめ", "mưa", "rain", true
	case strings.Contains(symbol, "fog"):
		return 45, "霧", "きり", "sương mù", "fog", true
	case strings.HasPrefix(symbol, "partlycloudy"):
		return 2, "晴れ時々曇り", "はれときどきくもり", "nắng xen mây", "partly cloudy", true
	case strings.HasPrefix(symbol, "cloudy"):
		return 3, "曇り", "くもり", "nhiều mây", "cloudy", true
	case strings.HasPrefix(symbol, "clearsky") || strings.HasPrefix(symbol, "fair"):
		return 0, "晴れ", "はれ", "trời quang", "clear skies", true
	default:
		return 0, "", "", "", "", false
	}
}
