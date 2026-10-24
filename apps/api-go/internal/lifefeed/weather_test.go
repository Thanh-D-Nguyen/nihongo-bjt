package lifefeed

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestMETNorwayCommercialWeatherIsCachedAndContractValid(t *testing.T) {
	now := time.Date(2026, 10, 24, 11, 0, 0, 0, JST)
	calls := 0
	var conditional bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if !strings.Contains(r.Header.Get("User-Agent"), "https://example.org/contact") || r.URL.Query().Get("lat") != "35.6762" {
			t.Errorf("unexpected MET Norway request: %s %s", r.Header.Get("User-Agent"), r.URL.String())
		}
		w.Header().Set("Expires", now.Add(time.Duration(calls)*30*time.Minute).UTC().Format(http.TimeFormat))
		w.Header().Set("Last-Modified", now.Add(-time.Hour).UTC().Format(http.TimeFormat))
		if calls == 2 {
			conditional = r.Header.Get("If-Modified-Since") != ""
			w.WriteHeader(http.StatusNotModified)
			return
		}
		fmt.Fprintf(w, `{"properties":{"meta":{"updated_at":%q},"timeseries":[{"time":%q,"data":{"instant":{"details":{"air_temperature":18.2}},"next_1_hours":{"summary":{"symbol_code":"rain_day"}}}}]}}`, now.Add(-time.Hour).UTC().Format(time.RFC3339), now.Add(30*time.Minute).UTC().Format(time.RFC3339))
	}))
	defer srv.Close()
	provider := NewWeatherProvider("KotobaWorks/1.0 https://example.org/contact")
	provider.endpoint = srv.URL
	first, err := provider.Forecast(context.Background(), "tokyo", now)
	if err != nil || first.Provenance != "live" || first.Lesson.Source.LicenseStatus != "commercial" || first.Scene.WeatherCode == nil || *first.Scene.WeatherCode != 61 {
		t.Fatalf("invalid licensed forecast: %v %+v", err, first)
	}
	if err = ValidateCard(first); err != nil || first.Lesson.Source.FetchedAt != now {
		t.Fatalf("weather card fails mobile contract: %v %+v", err, first.Lesson.Source)
	}
	second, err := provider.Forecast(context.Background(), "tokyo", now.Add(10*time.Minute))
	if err != nil || calls != 1 || second.Lesson.Source.FetchedAt != first.Lesson.Source.FetchedAt {
		t.Fatalf("cache miss or incorrect fetch metadata: calls=%d err=%v", calls, err)
	}
	third, err := provider.Forecast(context.Background(), "tokyo", now.Add(31*time.Minute))
	if err != nil || calls != 2 || !conditional || third.Lesson.Source.FetchedAt != first.Lesson.Source.FetchedAt {
		t.Fatalf("conditional refresh violated MET cache terms: calls=%d conditional=%v err=%v", calls, conditional, err)
	}
}

func TestMETNorwayRequiresContactAndSkipsUnknownSymbols(t *testing.T) {
	if NewWeatherProvider("").Enabled() || NewWeatherProvider("GenericAgent/1.0").Enabled() {
		t.Fatal("unidentified MET client was allowed")
	}
	if _, _, _, _, _, ok := weatherCondition("unrecognized"); ok {
		t.Fatal("unknown weather icon mapped to a made-up forecast")
	}
}

func TestMETNorwayDifferentCitiesFetchConcurrently(t *testing.T) {
	now := time.Date(2026, 10, 24, 11, 0, 0, 0, JST)
	var started atomic.Int32
	bothStarted := make(chan struct{})
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if started.Add(1) == 2 {
			close(bothStarted)
		}
		<-release
		w.Header().Set("Expires", now.Add(time.Hour).UTC().Format(http.TimeFormat))
		fmt.Fprintf(w, `{"properties":{"meta":{"updated_at":%q},"timeseries":[{"time":%q,"data":{"instant":{"details":{"air_temperature":18}},"next_1_hours":{"summary":{"symbol_code":"rain_day"}}}}]}}`, now.Add(-time.Hour).UTC().Format(time.RFC3339), now.Add(30*time.Minute).UTC().Format(time.RFC3339))
	}))
	defer srv.Close()
	provider := NewWeatherProvider("KotobaWorks/1.0 https://example.org/contact")
	provider.endpoint = srv.URL
	results := make(chan error, 2)
	for _, city := range []string{"tokyo", "osaka"} {
		go func(city string) {
			_, err := provider.Forecast(context.Background(), city, now)
			results <- err
		}(city)
	}
	concurrent := false
	select {
	case <-bothStarted:
		concurrent = true
	case <-time.After(time.Second):
	}
	close(release)
	for range 2 {
		if err := <-results; err != nil {
			t.Fatalf("weather fetch failed: %v", err)
		}
	}
	if !concurrent {
		t.Fatal("independent city forecast requests were serialized")
	}
}
