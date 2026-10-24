package main

import (
	"context"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestVerifyReindexRequiresCompletedTasksAndCompleteProjection(t *testing.T) {
	for _, tc := range []struct {
		name, task, stats, wantError string
	}{
		{"complete", `{"status":"succeeded"}`, `{"numberOfDocuments":1001}`, ""},
		{"missing documents", `{"status":"succeeded"}`, `{"numberOfDocuments":17}`, "incomplete search projection"},
		{"failed task", `{"status":"failed","error":{"code":"disk_full","message":"disk full"}}`, `{"numberOfDocuments":1001}`, "disk_full"},
		{"invalid stats", `{"status":"succeeded"}`, `invalid`, "decode search stats"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var requests []string
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests = append(requests, r.URL.Path)
				if r.Header.Get("Authorization") != "Bearer fixture" {
					t.Error("missing authorization")
				}
				switch r.URL.Path {
				case "/tasks/0":
					_, _ = w.Write([]byte(tc.task))
				case "/indexes/content_search/stats":
					_, _ = w.Write([]byte(tc.stats))
				default:
					http.NotFound(w, r)
				}
			}))
			defer server.Close()
			err := search.NewClient(server.URL, "fixture").VerifyReindex(context.Background(), search.ReindexResult{DocumentCount: 1001, TaskUIDs: []int64{0}})
			if tc.wantError == "" && err != nil || tc.wantError != "" && (err == nil || !strings.Contains(err.Error(), tc.wantError)) {
				t.Fatalf("VerifyReindex() error = %v, want %q", err, tc.wantError)
			}
			if len(requests) == 0 || requests[0] != "/tasks/0" {
				t.Fatalf("must wait for indexing before checking stats: %v", requests)
			}
		})
	}
}

func TestVerifyReindexAcceptsOnlyEmptyMissingIndex(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"code":"index_not_found"}`))
	}))
	defer server.Close()
	client := search.NewClient(server.URL, "")
	if err := client.VerifyReindex(context.Background(), search.ReindexResult{}); err != nil {
		t.Fatalf("empty canonical source needs no index: %v", err)
	}
	if err := client.VerifyReindex(context.Background(), search.ReindexResult{DocumentCount: 1}); err == nil {
		t.Fatal("nonempty canonical source must not accept a missing index")
	}
}
