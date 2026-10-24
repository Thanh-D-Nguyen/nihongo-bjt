package search

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestReindexReplacesProjectionAndRemovesStaleDocuments(t *testing.T) {
	var methods, paths, bodies []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		methods = append(methods, r.Method)
		paths = append(paths, r.URL.RequestURI())
		if r.Header.Get("Authorization") != "Bearer master" {
			t.Errorf("authorization=%q", r.Header.Get("Authorization"))
		}
		switch r.Method + " " + r.URL.Path {
		case "GET /indexes/content_search/documents":
			if r.URL.Query().Get("fields") != "id,kind" || r.URL.Query().Get("limit") != "1000" {
				t.Errorf("document list query=%v", r.URL.Query())
			}
			_, _ = w.Write([]byte(`{"results":[{"id":"old","kind":"lexeme"},{"id":"keep","kind":"kanji"}],"total":2}`))
		case "POST /indexes/content_search/documents":
			var docs []Document
			if err := json.NewDecoder(r.Body).Decode(&docs); err != nil {
				t.Errorf("decode documents: %v", err)
			}
			if r.URL.Query().Get("primaryKey") != "id" || len(docs) != 1 || docs[0].ID != "new" {
				t.Errorf("primaryKey=%q docs=%+v", r.URL.Query().Get("primaryKey"), docs)
			}
			bodies = append(bodies, r.URL.Path)
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"taskUid":11,"status":"enqueued"}`))
		case "POST /indexes/content_search/documents/delete-batch":
			var ids []string
			if err := json.NewDecoder(r.Body).Decode(&ids); err != nil {
				t.Errorf("decode stale ids: %v", err)
			}
			if len(ids) != 2 || ids[0] != "keep" || ids[1] != "old" {
				t.Errorf("deleted ids=%v", ids)
			}
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"taskUid":12,"status":"enqueued"}`))
		default:
			t.Errorf("unexpected Meilisearch request: %s %s", r.Method, r.URL.RequestURI())
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	got, err := NewClient(server.URL, "master").ReindexDocuments(context.Background(), []Document{{ID: "new", Kind: "lexeme", Title: "会議"}}, "")
	if err != nil {
		t.Fatalf("Reindex() error = %v", err)
	}
	if got.DocumentCount != 1 || len(got.TaskUIDs) != 2 || got.TaskUIDs[0] != 11 || got.TaskUIDs[1] != 12 {
		t.Fatalf("Reindex() = %+v", got)
	}
	if len(methods) != 3 || methods[0] != http.MethodGet || methods[1] != http.MethodPost || methods[2] != http.MethodPost {
		t.Fatalf("Meilisearch sequence = %v %v", methods, paths)
	}
}

func TestReindexPartialOnlyReplacesRequestedKind(t *testing.T) {
	var deleted []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method + " " + r.URL.Path {
		case "GET /indexes/content_search/documents":
			_, _ = w.Write([]byte(`{"results":[{"id":"old-lex","kind":"lexeme"},{"id":"keep-kanji","kind":"kanji"}],"total":2}`))
		case "POST /indexes/content_search/documents":
			var docs []Document
			if err := json.NewDecoder(r.Body).Decode(&docs); err != nil {
				t.Errorf("decode docs: %v", err)
			}
			if len(docs) != 1 || docs[0].Kind != "lexeme" {
				t.Errorf("docs=%+v", docs)
			}
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"taskUid":21}`))
		case "POST /indexes/content_search/documents/delete-batch":
			if err := json.NewDecoder(r.Body).Decode(&deleted); err != nil {
				t.Errorf("decode deleted IDs: %v", err)
			}
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"taskUid":22}`))
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	got, err := NewClient(server.URL, "").ReindexDocuments(context.Background(), []Document{{ID: "new-lex", Kind: "lexeme", Title: "会議"}}, "lexeme")
	if err != nil {
		t.Fatalf("Reindex partial: %v", err)
	}
	if len(deleted) != 1 || deleted[0] != "old-lex" || got.DocumentCount != 1 {
		t.Fatalf("deleted=%v result=%+v", deleted, got)
	}
}

func TestReindexPropagatesMeilisearchTaskErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_, _ = w.Write([]byte(`{"results":[],"total":0}`))
			return
		}
		http.Error(w, `{"message":"denied"}`, http.StatusForbidden)
	}))
	defer server.Close()
	if _, err := NewClient(server.URL, "").ReindexDocuments(context.Background(), []Document{{ID: "x", Kind: "lexeme"}}, ""); err == nil {
		t.Fatal("Reindex() swallowed a Meilisearch error")
	}
}

func TestReindexBatchesLargeProjectionAndReportsEmptyNoop(t *testing.T) {
	posts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_, _ = w.Write([]byte(`{"results":[],"total":0}`))
			return
		}
		posts++
		var documents []Document
		if err := json.NewDecoder(r.Body).Decode(&documents); err != nil {
			t.Errorf("decode documents: %v", err)
		}
		if len(documents) == 0 || len(documents) > 1000 {
			t.Errorf("batch size=%d", len(documents))
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"taskUid":31}`))
	}))
	defer server.Close()
	client := NewClient(server.URL, "")
	documents := make([]Document, 1001)
	for i := range documents {
		documents[i] = Document{ID: fmt.Sprintf("id-%d", i), Kind: "lexeme", Title: "fixture"}
	}
	got, err := client.ReindexDocuments(context.Background(), documents, "")
	if err != nil || posts != 2 || got.Status != "rebuild_enqueued" || got.DocumentCount != len(documents) || len(got.TaskUIDs) != 2 {
		t.Fatalf("large ReindexDocuments() = %+v, posts=%d, err=%v", got, posts, err)
	}
	noop, err := client.ReindexDocuments(context.Background(), nil, "")
	if err != nil || noop.Status != "no_changes" || len(noop.TaskUIDs) != 0 || posts != 2 {
		t.Fatalf("empty ReindexDocuments() = %+v, posts=%d, err=%v", noop, posts, err)
	}
}

func TestReindexCreatesMissingIndexAndClearsStaleDocsForEmptyProjection(t *testing.T) {
	t.Run("first index creation", func(t *testing.T) {
		var methods []string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			methods = append(methods, r.Method+" "+r.URL.RequestURI())
			if r.Method == http.MethodGet && r.URL.Path == "/indexes/content_search/documents" {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"code":"index_not_found"}`))
				return
			}
			if r.Method == http.MethodPost && r.URL.Path == "/indexes" {
				var index struct {
					UID        string `json:"uid"`
					PrimaryKey string `json:"primaryKey"`
				}
				if err := json.NewDecoder(r.Body).Decode(&index); err != nil || index.UID != IndexContent || index.PrimaryKey != "id" {
					t.Errorf("index create payload=%+v err=%v", index, err)
				}
				w.WriteHeader(http.StatusAccepted)
				_, _ = w.Write([]byte(`{"taskUid":40}`))
				return
			}
			if r.Method == http.MethodGet && r.URL.Path == "/tasks/40" {
				_, _ = w.Write([]byte(`{"uid":40,"status":"succeeded"}`))
				return
			}
			if r.Method != http.MethodPost || r.URL.Path != "/indexes/content_search/documents" || r.URL.Query().Get("primaryKey") != "id" {
				t.Errorf("request=%s %s", r.Method, r.URL.RequestURI())
			}
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"taskUid":41}`))
		}))
		defer server.Close()
		got, err := NewClient(server.URL, "").ReindexDocuments(context.Background(), []Document{{ID: "new", Kind: "lexeme"}}, "")
		if err != nil || got.Status != "rebuild_enqueued" || len(got.TaskUIDs) != 2 || got.TaskUIDs[0] != 40 || got.TaskUIDs[1] != 41 {
			t.Fatalf("first ReindexDocuments() = %+v, err=%v", got, err)
		}
		if len(methods) != 4 || methods[0] != "GET /indexes/content_search/documents?fields=id,kind&limit=1000&offset=0" || methods[1] != "POST /indexes" || methods[2] != "GET /tasks/40" || methods[3] != "POST /indexes/content_search/documents?primaryKey=id" {
			t.Fatalf("first-index request sequence=%v", methods)
		}
	})

	t.Run("empty projection deletes prior documents", func(t *testing.T) {
		deleted := false
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method + " " + r.URL.Path {
			case "GET /indexes/content_search/documents":
				_, _ = w.Write([]byte(`{"results":[{"id":"stale","kind":"lexeme"}],"total":1}`))
			case "POST /indexes/content_search/documents/delete-batch":
				var ids []string
				if err := json.NewDecoder(r.Body).Decode(&ids); err != nil {
					t.Errorf("decode deleted IDs: %v", err)
				}
				if len(ids) != 1 || ids[0] != "stale" {
					t.Errorf("deleted IDs=%v", ids)
				}
				deleted = true
				w.WriteHeader(http.StatusAccepted)
				_, _ = w.Write([]byte(`{"taskUid":42}`))
			default:
				t.Errorf("unexpected empty-projection request: %s %s", r.Method, r.URL.RequestURI())
				http.NotFound(w, r)
			}
		}))
		defer server.Close()
		got, err := NewClient(server.URL, "").ReindexDocuments(context.Background(), nil, "")
		if err != nil || !deleted || got.Status != "rebuild_enqueued" || got.DocumentCount != 0 || len(got.TaskUIDs) != 1 || got.TaskUIDs[0] != 42 {
			t.Fatalf("empty ReindexDocuments() = %+v, deleted=%t, err=%v", got, deleted, err)
		}
	})
}

func TestSearchReadsCanonicalContentSearchIndex(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/indexes/content_search/search" {
			t.Errorf("path=%q, want canonical content_search index", r.URL.Path)
		}
		var body struct {
			Q                string   `json:"q"`
			Limit            int      `json:"limit"`
			Offset           int      `json:"offset"`
			Filter           []string `json:"filter"`
			MatchingStrategy string   `json:"matchingStrategy"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		if body.Q != "会議" || body.Limit != 10 || body.Offset != 5 || body.MatchingStrategy != "all" || len(body.Filter) != 1 || body.Filter[0] != `kind = "lexeme"` {
			t.Errorf("unexpected Meilisearch query: %+v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"estimatedTotalHits":1,"hits":[{"id":"lex-1","kind":"lexeme","title":"会議","description":"cuộc họp","reading":"かいぎ"}]}`))
	}))
	defer server.Close()

	resp, err := NewClient(server.URL, "").Search(context.Background(), "会議", "lexeme", 10, 5)
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if resp.Total != 1 || len(resp.Results) != 1 || resp.Results[0].ID != "lex-1" || resp.Results[0].Title != "会議" {
		t.Fatalf("Search() response = %+v", resp)
	}
}

func TestSearchFallsBackWhenNoResultMatchesEveryQueryTerm(t *testing.T) {
	var strategies []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			MatchingStrategy string `json:"matchingStrategy"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		strategies = append(strategies, body.MatchingStrategy)
		if body.MatchingStrategy == "all" {
			_, _ = w.Write([]byte(`{"estimatedTotalHits":0,"hits":[]}`))
			return
		}
		_, _ = w.Write([]byte(`{"estimatedTotalHits":1,"hits":[{"id":"lex-1","kind":"lexeme","title":"会議室"}]}`))
	}))
	defer server.Close()

	resp, err := NewClient(server.URL, "").Search(context.Background(), "会議", "", 10, 0)
	if err != nil || len(resp.Results) != 1 || resp.Results[0].Title != "会議室" {
		t.Fatalf("Search() = %+v, error = %v", resp, err)
	}
	if len(strategies) != 2 || strategies[0] != "all" || strategies[1] != "last" {
		t.Fatalf("matching strategies = %v, want [all last]", strategies)
	}
}

func TestEnqueueTaskAcceptsZeroAndRejectsMissingUID(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		wantErr    bool
	}{
		{"first task", `{"taskUid":0}`, false},
		{"later task", `{"taskUid":7}`, false},
		{"missing task", `{}`, true},
		{"null task", `{"taskUid":null}`, true},
		{"negative task", `{"taskUid":-1}`, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusAccepted)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()
			uid, err := NewClient(server.URL, "").enqueueTask(context.Background(), http.MethodPost, "/indexes", []byte(`{}`))
			if (err != nil) != tc.wantErr {
				t.Fatalf("enqueue task %s: uid=%d error=%v, wantErr=%t", tc.body, uid, err, tc.wantErr)
			}
		})
	}
}
