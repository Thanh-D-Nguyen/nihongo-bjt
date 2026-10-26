package httpserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestBug263DailyGreetingTimeZone(t *testing.T) {
	for _, zone := range []string{"Asia/Tokyo", "America/Los_Angeles", "Pacific/Honolulu"} {
		t.Run(zone, func(t *testing.T) {
			location, err := time.LoadLocation(zone)
			if err != nil {
				t.Fatal(err)
			}
			now := time.Now().In(location)
			want := "こんばんは"
			if now.Hour() >= 5 && now.Hour() < 11 {
				want = "おはようございます"
			}
			if now.Hour() >= 11 && now.Hour() < 18 {
				want = "お疲れさまです"
			}
			rr := httptest.NewRecorder()
			dailyHomeHandler(nil, testLogger()).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/daily/home?timeZone="+zone, nil))
			var payload struct {
				Today    string `json:"today"`
				Greeting struct {
					Japanese string  `json:"japanese"`
					Reading  *string `json:"reading"`
				} `json:"greeting"`
			}
			if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
				t.Fatal(err)
			}
			if payload.Greeting.Japanese != want || payload.Today != now.Format("2006-01-02") {
				t.Fatalf("time-zone greeting: got %+v want %s on %s", payload, want, now.Format("2006-01-02"))
			}
			if payload.Greeting.Reading != nil && *payload.Greeting.Reading == "konnichiwa" {
				t.Fatal("reading should be kana, not romaji")
			}
		})
	}
}

func TestBug263CompanionHintContract(t *testing.T) {
	db := testPool(t)
	router, _, token := audit159Wave7Router(t, db)
	rr := audit159Wave7Request(t, router, token, http.MethodGet, "/api/companion/hint", "", false)
	var payload struct {
		AlgorithmVersion string `json:"algorithmVersion"`
		ComputedAt       string `json:"computedAt"`
		Primary          struct {
			Action     string `json:"action"`
			HrefSuffix string `json:"hrefSuffix"`
			Reasons    []any  `json:"reasons"`
		} `json:"primary"`
		Alternatives []any `json:"alternatives"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if rr.Code != http.StatusOK || payload.Primary.Action == "" || payload.Primary.HrefSuffix == "" || payload.Primary.Reasons == nil || payload.Alternatives == nil || payload.AlgorithmVersion != "2026-02-02a" {
		t.Fatalf("missing companion action contract: status=%d body=%s", rr.Code, rr.Body.String())
	}
	if _, err := time.Parse(time.RFC3339, payload.ComputedAt); err != nil {
		t.Fatalf("computedAt: %v", err)
	}
}
