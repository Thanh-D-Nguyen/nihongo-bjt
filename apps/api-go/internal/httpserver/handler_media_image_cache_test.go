package httpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
)

func TestIMG301MediaStreamCacheAndRevocation(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	bucket, err := media.OpenBucket(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { media.CloseBucket(bucket) })
	router := chi.NewRouter()
	handler := streamMediaHandler(media.NewStore(db), bucket, testLogger())
	router.Get("/api/media/{id}/stream", handler)
	router.Head("/api/media/{id}/stream", handler)
	for _, tc := range []struct {
		name, prefix, cache string
		owned               bool
	}{
		{"selected image", "image-selection/", "no-store", false},
		{"other media", "other/", streamCacheControl, false},
		{"owned image before linking", "other/", "no-store", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			id := newUUID(t)
			key := tc.prefix + id
			content := []byte("image content")
			var owner *string
			if tc.owned {
				user := newUUID(t)
				owner = &user
			}
			_, err := db.Exec(ctx, `INSERT INTO media.asset(id,object_key,mime_type,byte_size,status,owner_user_id,updated_at) VALUES ($1,$2,'image/jpeg',$3,'active',$4,now())`, id, key, len(content), owner)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE id=$1`, id) })
			if err := bucket.WriteAll(ctx, key, content, nil); err != nil {
				t.Fatal(err)
			}
			for _, reqCase := range []struct {
				method, rangeHeader string
				status              int
			}{
				{http.MethodGet, "", http.StatusOK}, {http.MethodHead, "", http.StatusOK}, {http.MethodGet, "bytes=0-3", http.StatusPartialContent},
			} {
				req := httptest.NewRequest(reqCase.method, "/api/media/"+id+"/stream", nil)
				if reqCase.rangeHeader != "" {
					req.Header.Set("Range", reqCase.rangeHeader)
				}
				res := httptest.NewRecorder()
				router.ServeHTTP(res, req)
				if res.Code != reqCase.status || res.Header().Get("Cache-Control") != tc.cache {
					t.Errorf("%s %s range=%q: status=%d cache=%q, want %d %q", tc.name, reqCase.method, reqCase.rangeHeader, res.Code, res.Header().Get("Cache-Control"), reqCase.status, tc.cache)
				}
			}
			if tc.name == "selected image" {
				if _, err := db.Exec(ctx, `UPDATE media.asset SET status='blocked',rights_status='blocked' WHERE id=$1`, id); err != nil {
					t.Fatal(err)
				}
				res := httptest.NewRecorder()
				router.ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/api/media/"+id+"/stream", nil))
				if res.Code != http.StatusNotFound {
					t.Errorf("revoked stream status=%d, want 404", res.Code)
				}
			}
		})
	}
}
