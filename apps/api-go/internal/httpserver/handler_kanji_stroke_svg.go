package httpserver

import (
	"bytes"
	"encoding/xml"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const strokeDirectory = "data/generated/kanji-strokes"
const maxStrokeSVGBytes = 1 << 20

func acceptsStrokeSVG(accept string) bool {
	for _, part := range strings.Split(accept, ",") {
		mediaType, params, err := mime.ParseMediaType(strings.TrimSpace(part))
		if err != nil || mediaType != "image/svg+xml" {
			continue
		}
		if q, ok := params["q"]; ok {
			quality, err := strconv.ParseFloat(q, 64)
			if err != nil || quality <= 0 || quality > 1 {
				continue
			}
		}
		return true
	}
	return false
}

func kanjiStrokeDirectory() string {
	for _, key := range []string{"KANJI_STROKE_REPO_ROOT", "NIHONGO_BJT_REPO_ROOT"} {
		if root := os.Getenv(key); root != "" {
			return filepath.Join(root, strokeDirectory)
		}
	}
	root, _ := os.Getwd()
	for root != "" {
		dir := filepath.Join(root, strokeDirectory)
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			return dir
		}
		parent := filepath.Dir(root)
		if parent == root {
			break
		}
		root = parent
	}
	return ""
}

func serveKanjiStrokeSVG(w http.ResponseWriter, r *http.Request, svgPath *string, logger *slog.Logger) {
	if svgPath == nil || strings.TrimSpace(*svgPath) == "" {
		writeJSONError(w, "stroke SVG not found", http.StatusNotFound)
		return
	}
	name := strings.TrimPrefix(*svgPath, strokeDirectory+"/")
	if name == *svgPath || strings.ContainsAny(name, "/\\") || filepath.Ext(name) != ".svg" {
		writeJSONError(w, "stroke SVG path forbidden", http.StatusForbidden)
		return
	}
	dir := kanjiStrokeDirectory()
	if dir == "" {
		writeJSONError(w, "stroke SVG not found", http.StatusNotFound)
		return
	}
	base, err := filepath.EvalSymlinks(dir)
	if err != nil {
		writeJSONError(w, "stroke SVG not found", http.StatusNotFound)
		return
	}
	asset, err := filepath.EvalSymlinks(filepath.Join(base, name))
	if err != nil {
		writeJSONError(w, "stroke SVG not found", http.StatusNotFound)
		return
	}
	if filepath.Dir(asset) != filepath.Clean(base) {
		writeJSONError(w, "stroke SVG path forbidden", http.StatusForbidden)
		return
	}
	info, err := os.Stat(asset)
	if err != nil || !info.Mode().IsRegular() {
		writeJSONError(w, "stroke SVG not found", http.StatusNotFound)
		return
	}
	if info.Size() > maxStrokeSVGBytes {
		writeJSONError(w, "invalid stroke SVG", http.StatusUnprocessableEntity)
		return
	}
	file, err := os.Open(asset)
	if err != nil {
		logger.Error("open stroke SVG", "error", err)
		writeJSONError(w, "stroke SVG unavailable", http.StatusInternalServerError)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxStrokeSVGBytes+1))
	if err != nil {
		logger.Error("read stroke SVG", "error", err)
		writeJSONError(w, "stroke SVG unavailable", http.StatusInternalServerError)
		return
	}
	if len(data) > maxStrokeSVGBytes || !validKanjiStrokeSVG(data) {
		writeJSONError(w, "invalid stroke SVG", http.StatusUnprocessableEntity)
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
	http.ServeContent(w, r, name, info.ModTime(), bytes.NewReader(data))
}

func validKanjiStrokeSVG(data []byte) bool {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	depth, seenRoot := 0, false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			return seenRoot && depth == 0
		}
		if err != nil {
			return false
		}
		switch token := token.(type) {
		case xml.StartElement:
			if depth == 0 {
				if seenRoot || token.Name.Local != "svg" || token.Name.Space != "http://www.w3.org/2000/svg" {
					return false
				}
				seenRoot = true
			}
			depth++
		case xml.EndElement:
			depth--
		case xml.CharData:
			if depth == 0 && strings.TrimSpace(string(token)) != "" {
				return false
			}
		case xml.Directive:
			return false
		case xml.ProcInst:
			if depth != 0 || seenRoot || token.Target != "xml" {
				return false
			}
		}
	}
}
