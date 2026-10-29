package loto

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func fetcherReturning(t *testing.T, status int, body []byte) *Fetcher {
	t.Helper()
	f := NewFetcher()
	f.Client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: status, Body: io.NopCloser(bytes.NewReader(body)), Header: http.Header{}, Request: r}, nil
	})}
	return f
}

func TestFetcherRejectsSourcesOutsideTheAllowlist(t *testing.T) {
	f := NewFetcher()
	for _, raw := range []string{
		"http://loto6.thekyo.jp/data/loto6.csv",
		"https://evil.example.com/loto6.csv",
		"https://someone@loto6.thekyo.jp/data/loto6.csv",
		"https://loto6.thekyo.jp:8443/data/loto6.csv",
	} {
		f.URLs[Loto6] = raw
		if _, _, err := f.Fetch(context.Background(), Loto6); !errors.Is(err, ErrSourceNotAllowed) {
			t.Errorf("%s: err = %v, want ErrSourceNotAllowed", raw, err)
		}
	}
	redirect := &http.Request{URL: &url.URL{Scheme: "https", Host: "evil.example.com", Path: "/x"}}
	if err := f.Client.CheckRedirect(redirect, nil); !errors.Is(err, ErrSourceNotAllowed) {
		t.Errorf("redirect to a foreign host: %v, want ErrSourceNotAllowed", err)
	}
	allowed := &http.Request{URL: &url.URL{Scheme: "https", Host: "loto7.thekyo.jp", Path: "/x"}}
	if err := f.Client.CheckRedirect(allowed, nil); err != nil {
		t.Errorf("redirect inside the allowlist: %v", err)
	}
	if err := f.Client.CheckRedirect(allowed, make([]*http.Request, 3)); err == nil {
		t.Error("a fourth redirect must be refused")
	}
}

func TestFetcherDecodesAllowlistedShiftJISAndSkipsCorruptRows(t *testing.T) {
	csvText := "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,BONUS数字\n" +
		"1,2000/10/5,2,8,10,13,27,30,39\n" +
		"2,2000/10/12,1,9,16,20,21,99,5\n" + // corrupt: 99 is out of range
		"3,2000/10/19,3,4,5,6,7,8,9\n"
	f := fetcherReturning(t, http.StatusOK, shiftJIS(t, csvText))
	draws, source, err := f.Fetch(context.Background(), Loto6)
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if len(draws) != 2 || draws[0].Number != 1 || draws[1].Number != 3 || !strings.HasPrefix(source, "https://loto6.thekyo.jp/") {
		t.Fatalf("draws=%+v source=%s, want the two valid rows", draws, source)
	}
}

func TestFetcherFailsCleanlyOnBadResponses(t *testing.T) {
	if _, _, err := fetcherReturning(t, http.StatusServiceUnavailable, nil).Fetch(context.Background(), Loto6); err == nil || !strings.Contains(err.Error(), "503") {
		t.Errorf("non-200: %v", err)
	}
	if _, _, err := fetcherReturning(t, http.StatusOK, bytes.Repeat([]byte("a"), maxCSVBytes+10)).Fetch(context.Background(), Loto6); !errors.Is(err, ErrInvalidInput) {
		t.Errorf("oversized body: %v, want ErrInvalidInput", err)
	}
	allBad := "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,BONUS数字\n1,2000/10/5,99,8,10,13,27,30,39\n"
	if _, _, err := fetcherReturning(t, http.StatusOK, shiftJIS(t, allBad)).Fetch(context.Background(), Loto6); !errors.Is(err, ErrInvalidInput) {
		t.Errorf("no valid rows: %v, want ErrInvalidInput", err)
	}
}

func TestParseCSVLenientReportsEachSkippedRow(t *testing.T) {
	text := "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,BONUS数字\n" +
		"1,2000/10/5,2,8,10,13,27,30,39\n" +
		"2,2000/10/12,1,9,16,20,21,99,5\n" +
		"1,2000/10/19,3,4,5,6,7,8,9\n"
	draws, skipped, err := ParseCSVLenient(text, Loto6)
	if err != nil || len(draws) != 1 || len(skipped) != 2 {
		t.Fatalf("draws=%d skipped=%v err=%v, want 1 valid and 2 skipped", len(draws), skipped, err)
	}
	if !strings.Contains(skipped[0].Error(), "row 3") || !strings.Contains(skipped[1].Error(), "duplicate") {
		t.Fatalf("skipped = %v", skipped)
	}
}
