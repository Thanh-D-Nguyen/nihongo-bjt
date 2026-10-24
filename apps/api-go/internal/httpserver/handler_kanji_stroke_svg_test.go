package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestKanjiStrokeNegotiatesSVGAndPreservesMetadata(t *testing.T) {
	db := testPool(t)
	root := t.TempDir()
	t.Setenv("KANJI_STROKE_REPO_ROOT", root)
	dir := filepath.Join(root, "data/generated/kanji-strokes")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109"><path d="M1 1L20 20" stroke="black"/></svg>`
	if err := os.WriteFile(filepath.Join(dir, "sample.svg"), []byte(svg), 0o644); err != nil {
		t.Fatal(err)
	}
	id := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,stroke_svg_source,stroke_svg_path,status,created_at,updated_at) VALUES ($1,$2,'KanjiVG','data/generated/kanji-strokes/sample.svg','active',now(),now())`, id, "政"+id[:4]); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, id) })
	handler := getKanjiStrokeHandler(db, slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/api/kanji/"+id+"/stroke", nil)
	req.Header.Set("Accept", "image/svg+xml")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != 200 || !strings.HasPrefix(res.Header().Get("Content-Type"), "image/svg+xml") || res.Body.String() != svg {
		t.Fatalf("SVG representation status=%d type=%q body=%s", res.Code, res.Header().Get("Content-Type"), res.Body.String())
	}
	if res.Header().Get("X-Content-Type-Options") != "nosniff" || !strings.Contains(res.Header().Get("Content-Security-Policy"), "sandbox") || !strings.Contains(res.Header().Get("Vary"), "Accept") {
		t.Fatalf("SVG safety/cache headers missing: %v", res.Header())
	}
	metadata := httptest.NewRecorder()
	handler.ServeHTTP(metadata, httptest.NewRequest(http.MethodGet, req.URL.String(), nil))
	var body struct {
		SVGPath string `json:"svgPath"`
	}
	if err := json.Unmarshal(metadata.Body.Bytes(), &body); err != nil || metadata.Code != 200 || body.SVGPath != "data/generated/kanji-strokes/sample.svg" {
		t.Fatalf("JSON metadata contract changed: status=%d body=%s", metadata.Code, metadata.Body.String())
	}
}

func TestKanjiStrokeRejectsUnsafeAssets(t *testing.T) {
	db := testPool(t)
	root := t.TempDir()
	t.Setenv("KANJI_STROKE_REPO_ROOT", root)
	dir := filepath.Join(root, "data/generated/kanji-strokes")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for file, data := range map[string]string{
		filepath.Join(root, "outside.svg"): `<svg xmlns="http://www.w3.org/2000/svg"/>`,
		filepath.Join(dir, "invalid.svg"):  `<html>not SVG</html>`,
		filepath.Join(dir, "trailing.svg"): `<svg xmlns="http://www.w3.org/2000/svg"/><broken`,
		filepath.Join(dir, "roots.svg"):    `<svg xmlns="http://www.w3.org/2000/svg"/><svg/>`,
		filepath.Join(dir, "large.svg"):    strings.Repeat("x", (1<<20)+1),
	} {
		if err := os.WriteFile(file, []byte(data), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Symlink(filepath.Join(root, "outside.svg"), filepath.Join(dir, "link.svg")); err != nil {
		t.Fatal(err)
	}
	id := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,status,created_at,updated_at) VALUES ($1,$2,'active',now(),now())`, id, "府"+id[:4]); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, id) })
	for _, tc := range []struct {
		name, path string
		status     int
	}{
		{"traversal", "data/generated/kanji-strokes" + "/../outside.svg", 403},
		{"absolute", filepath.Join(root, "outside.svg"), 403},
		{"remote", "https://example.com/kanji.svg", 403},
		{"symlink escape", "data/generated/kanji-strokes" + "/link.svg", 403},
		{"missing", "data/generated/kanji-strokes" + "/missing.svg", 404},
		{"malformed", "data/generated/kanji-strokes" + "/invalid.svg", 422},
		{"trailing", "data/generated/kanji-strokes" + "/trailing.svg", 422},
		{"multiple roots", "data/generated/kanji-strokes" + "/roots.svg", 422},
		{"oversize", "data/generated/kanji-strokes" + "/large.svg", 422},
		{"no asset", "", 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := db.Exec(context.Background(), `UPDATE content.kanji SET stroke_svg_path=$1 WHERE id=$2`, tc.path, id); err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(http.MethodGet, "/api/kanji/"+id+"/stroke", nil)
			req.Header.Set("Accept", "image/svg+xml")
			res := httptest.NewRecorder()
			getKanjiStrokeHandler(db, slog.Default()).ServeHTTP(res, req)
			if res.Code != tc.status {
				t.Fatalf("status=%d, want=%d, body=%s", res.Code, tc.status, res.Body.String())
			}
		})
	}
}
