package httpserver

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Preview canvas, matching the Open Graph share card size.
const (
	sharePreviewWidth   = 1200
	sharePreviewHeight  = 630
	sharePreviewMaxBody = 64 << 10
)

var (
	// Brand colors are interpolated into SVG attributes, so only plain hex colors are accepted.
	sharePreviewHexColor = regexp.MustCompile(`^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)
	sharePreviewBadge    = regexp.MustCompile(`^[A-Za-z0-9 _.\-]{0,64}$`)
	// Pattern names are the closed set the Admin form offers; overlays are validated but not drawn in this preview.
	sharePreviewPatterns = map[string]struct{}{
		"none": {}, "dots": {}, "waves": {}, "grid": {}, "stripes": {},
		"diamonds": {}, "circles": {}, "zigzag": {}, "crosshatch": {}, "sakura": {},
	}
)

type adminGrowthSharePreviewConfig struct {
	BrandBg     string `json:"brandBg"`
	BrandBgEnd  string `json:"brandBgEnd"`
	BrandFg     string `json:"brandFg"`
	BrandAccent string `json:"brandAccent"`
	BadgeKey    string `json:"badgeKey"`
	Pattern     string `json:"pattern"`
}

type adminGrowthSharePreviewRequest struct {
	Headline string                        `json:"headline"`
	Sub      string                        `json:"sub"`
	Kind     string                        `json:"kind"`
	Config   adminGrowthSharePreviewConfig `json:"config"`
}

// adminGrowthSharePreviewHandler implements POST /api/admin/growth/share-template/preview.
// It renders the postcard as an SVG document and returns it base64-encoded. Nothing is persisted.
func adminGrowthSharePreviewHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req adminGrowthSharePreviewRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, sharePreviewMaxBody)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Headline = strings.TrimSpace(req.Headline)
		req.Sub = strings.TrimSpace(req.Sub)
		if !validSharePreviewText(req.Headline) || !validSharePreviewText(req.Sub) {
			writeJSONError(w, "headline and sub must be 1-200 characters", http.StatusBadRequest)
			return
		}
		if !validSharePreviewKind(req.Kind) {
			writeJSONError(w, "invalid preview kind", http.StatusBadRequest)
			return
		}
		cfg := req.Config
		for _, color := range []string{cfg.BrandBg, cfg.BrandBgEnd, cfg.BrandFg, cfg.BrandAccent} {
			if color != "" && !sharePreviewHexColor.MatchString(color) {
				writeJSONError(w, "brand colors must be hex colors", http.StatusBadRequest)
				return
			}
		}
		if !sharePreviewBadge.MatchString(cfg.BadgeKey) {
			writeJSONError(w, "invalid badge key", http.StatusBadRequest)
			return
		}
		if cfg.Pattern != "" {
			if _, ok := sharePreviewPatterns[cfg.Pattern]; !ok {
				writeJSONError(w, "invalid pattern", http.StatusBadRequest)
				return
			}
		}
		svg := renderSharePreviewSVG(req)
		writeJSON(w, http.StatusOK, map[string]any{
			"base64Svg":   base64.StdEncoding.EncodeToString([]byte(svg)),
			"contentType": "image/svg+xml",
			"width":       sharePreviewWidth,
			"height":      sharePreviewHeight,
		})
	}
}

func validSharePreviewText(text string) bool {
	length := utf8.RuneCountInString(text)
	return length >= 1 && length <= 200
}

func validSharePreviewKind(kind string) bool {
	for _, allowed := range growthPostcardKinds {
		if kind == allowed {
			return true
		}
	}
	return false
}

func renderSharePreviewSVG(req adminGrowthSharePreviewRequest) string {
	cfg := req.Config
	bg := defaultSharePreviewColor(cfg.BrandBg, "#0f172a")
	bgEnd := defaultSharePreviewColor(cfg.BrandBgEnd, bg)
	fg := defaultSharePreviewColor(cfg.BrandFg, "#ffffff")
	accent := defaultSharePreviewColor(cfg.BrandAccent, "#38bdf8")

	headlines := wrapSharePreviewText(xmlSafeSharePreviewText(req.Headline), 26, 3)
	subs := wrapSharePreviewText(xmlSafeSharePreviewText(req.Sub), 44, 2)

	var b strings.Builder
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" role="img">`,
		sharePreviewWidth, sharePreviewHeight, sharePreviewWidth, sharePreviewHeight)
	fmt.Fprintf(&b, `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>`, bg, bgEnd)
	fmt.Fprintf(&b, `<rect width="%d" height="%d" fill="url(#bg)"/>`, sharePreviewWidth, sharePreviewHeight)
	fmt.Fprintf(&b, `<rect x="72" y="72" width="12" height="486" rx="6" fill="%s"/>`, accent)
	if badge := strings.TrimSpace(cfg.BadgeKey); badge != "" {
		fmt.Fprintf(&b, `<text x="112" y="132" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="%s">%s</text>`,
			accent, html.EscapeString(badge))
	}
	y := 250
	for _, line := range headlines {
		fmt.Fprintf(&b, `<text x="112" y="%d" font-family="system-ui, sans-serif" font-size="60" font-weight="800" fill="%s">%s</text>`,
			y, fg, html.EscapeString(line))
		y += 76
	}
	y += 14
	for _, line := range subs {
		fmt.Fprintf(&b, `<text x="112" y="%d" font-family="system-ui, sans-serif" font-size="30" fill="%s" fill-opacity="0.85">%s</text>`,
			y, fg, html.EscapeString(line))
		y += 44
	}
	b.WriteString(`</svg>`)
	return b.String()
}

// xmlSafeSharePreviewText maps characters that XML 1.0 forbids (control characters and the U+FFFE/U+FFFF
// noncharacters) to spaces, so the rendered document stays well-formed. Word boundaries are preserved.
func xmlSafeSharePreviewText(text string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || r == 0xFFFE || r == 0xFFFF {
			return ' '
		}
		return r
	}, text)
}

func defaultSharePreviewColor(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

// wrapSharePreviewText packs words into lines of at most maxRunes runes and keeps at most maxLines lines.
// Words longer than a line are split by rune count, so no text is silently dropped before the overflow mark.
// When text does not fit, the last kept line ends with an ellipsis.
func wrapSharePreviewText(text string, maxRunes, maxLines int) []string {
	var lines []string
	current := ""
	for _, word := range strings.Fields(text) {
		runes := []rune(word)
		for len(runes) > 0 {
			take := min(len(runes), maxRunes)
			chunk := string(runes[:take])
			runes = runes[take:]
			if current == "" {
				current = chunk
				continue
			}
			if utf8.RuneCountInString(current)+1+take <= maxRunes {
				current += " " + chunk
				continue
			}
			lines = append(lines, current)
			current = chunk
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	if len(lines) == 0 {
		return []string{""}
	}
	if len(lines) <= maxLines {
		return lines
	}
	lines = lines[:maxLines]
	last := []rune(lines[maxLines-1])
	if len(last) > maxRunes-1 {
		last = last[:maxRunes-1]
	}
	lines[maxLines-1] = string(last) + "…"
	return lines
}
