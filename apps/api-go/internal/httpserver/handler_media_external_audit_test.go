package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
	"gocloud.dev/blob"
)

const mediaAuditFixturePNG = "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"

type mediaAuditResolver []net.IPAddr

func (r mediaAuditResolver) LookupIPAddr(context.Context, string) ([]net.IPAddr, error) {
	return r, nil
}

type mediaAuditRoundTripper struct {
	base http.RoundTripper
	url  *url.URL
}

func (rt mediaAuditRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	copyReq := req.Clone(req.Context())
	copyURL := *req.URL
	copyURL.Scheme, copyURL.Host = rt.url.Scheme, rt.url.Host
	copyReq.URL = &copyURL
	copyReq.Host = rt.url.Host
	return rt.base.RoundTrip(copyReq)
}

func mediaAuditProxyRouter(t *testing.T, db *pgxpool.Pool, bucket *blob.Bucket, resolver mediaProxyResolver, transport http.RoundTripper) http.Handler {
	t.Helper()
	r := chi.NewRouter()
	guard := authn.LearnerGuard(session.NewStore(db), authn.DefaultGuardConfig(testLogger()))
	csrf := authn.CSRFGuard(authn.CSRFConfig{Logger: testLogger(), TrustedOrigins: []string{wave9Origin}})
	r.With(guard, csrf).Post("/api/media/proxy-image", postMediaProxyImageHandlerWithResolver(db, bucket, testLogger(), resolver, transport))
	return r
}

func TestAudit159ProxyImagePersistsPendingRightsAsset(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Proxy fixture learner", "proxy-"+userID+"@example.test", "")
	token := createLearnerSession(t, session.NewStore(db), userID)
	bucket, err := media.OpenBucket(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { media.CloseBucket(bucket) })
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ok":
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write([]byte(mediaAuditFixturePNG))
		case "/redirect":
			http.Redirect(w, r, "https://redirect.example.test/next", http.StatusFound)
		case "/large":
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Content-Length", fmt.Sprint(localPresignedUploadMaxBytes+1))
			_, _ = w.Write(make([]byte, localPresignedUploadMaxBytes+1))
		case "/wrong-mime":
			w.Header().Set("Content-Type", "image/jpeg")
			_, _ = w.Write([]byte(mediaAuditFixturePNG))
		}
	}))
	defer server.Close()
	serverURL, _ := url.Parse(server.URL)
	transport := mediaAuditRoundTripper{base: server.Client().Transport, url: serverURL}
	allowed := mediaAuditResolver{{IP: net.ParseIP("8.8.8.8")}}
	router := mediaAuditProxyRouter(t, db, bucket, allowed, transport)
	w := wave9Request(router, http.MethodPost, "/api/media/proxy-image", `{"url":"https://images.example.test/ok?secret=do-not-store","source":"fixture","altText":"classroom"}`, token)
	if w.Code != http.StatusCreated {
		t.Fatalf("proxy image status=%d body=%s", w.Code, w.Body.String())
	}
	var got struct {
		AssetID string `json:"assetId"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil || got.AssetID == "" {
		t.Fatalf("proxy image response=%s err=%v", w.Body.String(), err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM media.asset WHERE id=$1`, got.AssetID)
		_ = bucket.Delete(context.Background(), got.AssetID)
	})
	var owner, status, sourceURL, provenance, accessibility string
	var size int
	if err := db.QueryRow(context.Background(), `SELECT owner_user_id::text,status,source_url,provenance::text,accessibility::text,byte_size FROM media.asset WHERE id=$1`, got.AssetID).Scan(&owner, &status, &sourceURL, &provenance, &accessibility, &size); err != nil {
		t.Fatalf("load persisted asset: %v", err)
	}
	if owner != userID || status != "pending_review" || sourceURL != "https://images.example.test" || size != len(mediaAuditFixturePNG) || strings.Contains(provenance, "do-not-store") || !strings.Contains(accessibility, "classroom") {
		t.Fatalf("persisted asset owner=%s status=%s source=%s provenance=%s accessibility=%s size=%d", owner, status, sourceURL, provenance, accessibility, size)
	}
	if asset, err := media.NewStore(db).GetAsset(context.Background(), got.AssetID); err != nil || asset != nil {
		t.Fatalf("unreviewed external asset must not be publicly streamable: asset=%+v err=%v", asset, err)
	}
	stored, err := bucket.ReadAll(context.Background(), got.AssetID)
	if err != nil || string(stored) != mediaAuditFixturePNG {
		t.Fatalf("stored object bytes=%q err=%v", stored, err)
	}

	for _, tc := range []struct {
		name, target string
		resolver     mediaProxyResolver
		status       int
	}{
		{name: "private dns", target: "https://private.example.test/ok", resolver: mediaAuditResolver{{IP: net.ParseIP("10.1.2.3")}}, status: http.StatusForbidden},
		{name: "link local dns", target: "https://private.example.test/ok", resolver: mediaAuditResolver{{IP: net.ParseIP("169.254.10.20")}}, status: http.StatusForbidden},
		{name: "mixed public and private dns", target: "https://private.example.test/ok", resolver: mediaAuditResolver{{IP: net.ParseIP("8.8.8.8")}, {IP: net.ParseIP("192.168.1.10")}}, status: http.StatusForbidden},
		{name: "redirect", target: "https://images.example.test/redirect", resolver: allowed, status: http.StatusBadGateway},
		{name: "oversize", target: "https://images.example.test/large", resolver: allowed, status: http.StatusRequestEntityTooLarge},
		{name: "wrong mime", target: "https://images.example.test/wrong-mime", resolver: allowed, status: http.StatusUnsupportedMediaType},
		{name: "http scheme", target: "http://images.example.test/ok", resolver: allowed, status: http.StatusBadRequest},
		{name: "url credentials", target: "https://user:pass@images.example.test/ok", resolver: allowed, status: http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := mediaAuditProxyRouter(t, db, bucket, tc.resolver, transport)
			body := fmt.Sprintf(`{"url":%q}`, tc.target)
			w := wave9Request(router, http.MethodPost, "/api/media/proxy-image", body, token)
			if w.Code != tc.status {
				t.Fatalf("proxy status=%d want=%d body=%s", w.Code, tc.status, w.Body.String())
			}
		})
	}
	invalid := wave9Request(router, http.MethodPost, "/api/media/proxy-image", `{"url":"https://127.0.0.1/admin"}`, token)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("IP literal status=%d body=%s", invalid.Code, invalid.Body.String())
	}
}

func TestAudit159SearchImagesReportsMissingProvider(t *testing.T) {
	_, router, _, token, _ := wave9Router(t, false)
	w := wave9Request(router, http.MethodPost, "/api/media/search-images", `{"query":"会議","limit":6}`, token)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("search image status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "UNSPLASH_ACCESS_KEY") || !strings.Contains(w.Body.String(), "PIXABAY_API_KEY") || !strings.Contains(w.Body.String(), "provider integration") {
		t.Fatalf("missing provider details in response: %s", w.Body.String())
	}
}

func TestAudit159SearchSuggestPublishedLexemeContract(t *testing.T) {
	db, router, _, _, _ := wave9Router(t, false)
	activeID, publishedID, draftID := newUUID(t), newUUID(t), newUUID(t)
	prefix := "suggest-audit-" + activeID[:8]
	for _, item := range []struct {
		id, headword, status string
	}{{activeID, prefix + "-active", "active"}, {publishedID, prefix + "-published", "published"}, {draftID, prefix + "-draft", "draft"}} {
		if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,reading,status,created_at,updated_at) VALUES ($1,$2,'よみ',$3,NOW(),NOW())`, item.id, item.headword, item.status); err != nil {
			t.Fatalf("seed %s lexeme: %v", item.status, err)
		}
	}
	defer db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id = ANY($1::uuid[])`, []string{activeID, publishedID, draftID})
	w := wave9Request(router, http.MethodGet, "/api/search/suggest?q="+prefix+"&limit=6", "", "")
	if w.Code != http.StatusOK {
		t.Fatalf("search suggest status=%d body=%s", w.Code, w.Body.String())
	}
	var got []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode suggestions: %v", err)
	}
	if len(got) != 2 || got[0]["id"] != activeID || got[0]["kind"] != "lexeme" || got[0]["reading"] != "よみ" || got[0]["title"] != prefix+"-active" || got[1]["id"] != publishedID || got[1]["title"] != prefix+"-published" {
		t.Fatalf("unexpected caller contract or draft leaked: %#v", got)
	}
	if _, exists := got[0]["text"]; exists {
		t.Fatalf("legacy text field leaked: %#v", got[0])
	}
}
