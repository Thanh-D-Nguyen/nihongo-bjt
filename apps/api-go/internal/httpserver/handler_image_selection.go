package httpserver

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gocloud.dev/blob"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/imagesearch"
)

// imageSelectionSigner must use the same secret on all API instances.
type imageSelectionSigner struct{ key []byte }
type imageSelectionClaims struct {
	UserID  string            `json:"userId"`
	Nonce   string            `json:"nonce"`
	Expires int64             `json:"expires"`
	Image   imagesearch.Image `json:"image"`
}

func newImageSelectionSigner(key []byte) (*imageSelectionSigner, error) {
	if len(key) < 32 {
		return nil, errors.New("image selection signing key must contain at least 32 bytes")
	}
	return &imageSelectionSigner{key: append([]byte(nil), key...)}, nil
}

func (s *imageSelectionSigner) issue(userID string, image imagesearch.Image, now time.Time) (string, error) {
	if userID == "" || !validSelectionImage(image) {
		return "", errors.New("invalid image selection")
	}
	image = selectionAttribution(image)
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	data, err := json.Marshal(imageSelectionClaims{UserID: userID, Nonce: hex.EncodeToString(nonce), Expires: now.Add(15 * time.Minute).Unix(), Image: image})
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(data)
	mac := hmac.New(sha256.New, s.key)
	_, _ = mac.Write([]byte(payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}

func selectionAttribution(image imagesearch.Image) imagesearch.Image {
	if image.Provider != "unsplash" {
		return image
	}
	addReferral := func(raw string) string {
		u, _ := url.Parse(raw)
		q := u.Query()
		q.Set("utm_source", "kotobaworks")
		q.Set("utm_medium", "referral")
		u.RawQuery = q.Encode()
		return u.String()
	}
	image.SourceURL = addReferral(image.SourceURL)
	image.AuthorURL = addReferral(image.AuthorURL)
	return image
}

func (s *imageSelectionSigner) verify(token, userID string, now time.Time) (imageSelectionClaims, error) {
	var claims imageSelectionClaims
	parts := strings.Split(token, ".")
	if len(token) > 16000 || len(parts) != 2 {
		return claims, errors.New("invalid selection handle")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return claims, errors.New("invalid selection handle")
	}
	mac := hmac.New(sha256.New, s.key)
	_, _ = mac.Write([]byte(parts[0]))
	if !hmac.Equal(signature, mac.Sum(nil)) {
		return claims, errors.New("invalid selection handle")
	}
	data, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || json.Unmarshal(data, &claims) != nil || claims.UserID != userID || userID == "" || claims.Expires <= now.Unix() || len(claims.Nonce) != 32 || !validSelectionImage(claims.Image) {
		return imageSelectionClaims{}, errors.New("invalid selection handle")
	}
	if _, err := hex.DecodeString(claims.Nonce); err != nil {
		return imageSelectionClaims{}, errors.New("invalid selection handle")
	}
	return claims, nil
}

func selectionURL(raw string, hosts ...string) bool {
	if len(raw) == 0 || len(raw) > 4096 {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Opaque != "" || u.Fragment != "" || u.Port() != "" {
		return false
	}
	for _, host := range hosts {
		if u.Host == host {
			return true
		}
	}
	return false
}

// rehostedImageHosts lists the hosts each rehosted provider may serve images from.
var rehostedImageHosts = map[string][]string{
	"pixabay":   {"pixabay.com", "cdn.pixabay.com"},
	"pexels":    {"images.pexels.com"},
	"wikimedia": {"upload.wikimedia.org", "thumb.wikimedia.org"},
}

func optionalSelectionURL(raw string, hosts ...string) bool {
	return raw == "" || selectionURL(raw, hosts...)
}

func validSelectionImage(image imagesearch.Image) bool {
	if strings.TrimSpace(image.Author) == "" || len(image.Author) > 512 || len(image.License) > 512 {
		return false
	}
	switch image.Provider {
	case "unsplash":
		return image.License == "Unsplash License" && selectionURL(image.URL, "images.unsplash.com") && selectionURL(image.SourceURL, "unsplash.com") && selectionURL(image.AuthorURL, "unsplash.com") && selectionURL(image.DownloadLocation, "api.unsplash.com") && strings.HasPrefix(mustSelectionPath(image.DownloadLocation), "/photos/") && strings.HasSuffix(mustSelectionPath(image.DownloadLocation), "/download")
	case "pixabay":
		return image.License == "Pixabay Content License" && selectionURL(image.URL, rehostedImageHosts["pixabay"]...) && selectionURL(image.SourceURL, "pixabay.com")
	case "pexels":
		return image.License == "Pexels License" && selectionURL(image.URL, rehostedImageHosts["pexels"]...) && selectionURL(image.SourceURL, "www.pexels.com") && optionalSelectionURL(image.AuthorURL, "www.pexels.com") && optionalSelectionURL(image.LicenseURL, "www.pexels.com")
	case "wikimedia":
		return imagesearch.LicenseAllowed(image.License, image.LicenseURL) && selectionURL(image.LicenseURL, "creativecommons.org") && selectionURL(image.URL, rehostedImageHosts["wikimedia"]...) && selectionURL(image.SourceURL, "commons.wikimedia.org")
	default:
		return false
	}
}

func mustSelectionPath(raw string) string { u, _ := url.Parse(raw); return u.Path }

type imageSelectionSearch interface {
	Search(context.Context, string) ([]imagesearch.Image, error)
}

type imageSelectionTracker interface {
	TrackDownload(context.Context, string) error
}

type imageSelectionLimiter interface {
	Allow(context.Context, string) (bool, error)
}

type imageSelectionResult struct {
	Handle     string `json:"handle"`
	Provider   string `json:"provider"`
	URL        string `json:"url"`
	SourceURL  string `json:"sourceUrl"`
	Author     string `json:"author"`
	AuthorURL  string `json:"authorUrl,omitempty"`
	License    string `json:"license"`
	LicenseURL string `json:"licenseUrl,omitempty"`
}

// postImageSelectionSearchHandler creates handles only from server-fetched results.
func postImageSelectionSearchHandler(search imageSelectionSearch, signer *imageSelectionSigner, limiter imageSelectionLimiter, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if search == nil || signer == nil || limiter == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		allowed, err := limiter.Allow(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("image selection limiter failed", "error", err)
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		if !allowed {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		var input struct {
			Query string `json:"query"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&input) != nil || decoder.Decode(&struct{}{}) != io.EOF || strings.TrimSpace(input.Query) == "" || len(input.Query) > 200 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		images, err := search.Search(r.Context(), input.Query)
		if err != nil {
			logger.Warn("image selection search failed", "error", err)
			writeJSONError(w, "image search unavailable", http.StatusBadGateway)
			return
		}
		results := make([]imageSelectionResult, 0, len(images))
		for _, image := range images {
			if !validSelectionImage(image) {
				continue
			}
			image = selectionAttribution(image)
			token, err := signer.issue(identity.UserID, image, time.Now())
			if err != nil {
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			results = append(results, imageSelectionResult{token, image.Provider, image.URL, image.SourceURL, image.Author, image.AuthorURL, image.License, image.LicenseURL})
		}
		if len(images) > 0 && len(results) == 0 {
			writeJSONError(w, "image provider is not available for selection", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(map[string]any{"results": results})
	}
}

// postImageSelectionHandler persists an owned, pending-review asset from a signed handle.
func postImageSelectionHandler(db *pgxpool.Pool, bucket *blob.Bucket, tracker imageSelectionTracker, signer *imageSelectionSigner, limiter imageSelectionLimiter, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if db == nil || bucket == nil || tracker == nil || signer == nil || limiter == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		allowed, err := limiter.Allow(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("image selection limiter failed", "error", err)
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		if !allowed {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		var input struct {
			Handle string `json:"handle"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 18<<10))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&input) != nil || decoder.Decode(&struct{}{}) != io.EOF {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		claims, err := signer.verify(input.Handle, identity.UserID, time.Now())
		if err != nil {
			writeJSONError(w, "invalid selection handle", http.StatusBadRequest)
			return
		}
		id, err := persistImageSelection(r.Context(), db, bucket, tracker, claims, nil)
		if err != nil {
			logger.Error("persist image selection failed", "provider", claims.Image.Provider, "error", err)
			writeJSONError(w, "image selection unavailable", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{"assetId": id, "status": "pending_review"})
	}
}

func persistImageSelection(ctx context.Context, db *pgxpool.Pool, bucket *blob.Bucket, tracker imageSelectionTracker, claims imageSelectionClaims, client *http.Client) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	tx, err := db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(context.Background())
	key := "image-selection/" + claims.Nonce
	image := claims.Image
	delivery := "rehosted"
	if image.Provider == "unsplash" {
		delivery = "hotlink"
	}
	provenance, err := json.Marshal(map[string]string{"provider": image.Provider, "delivery": delivery, "imageUrl": image.URL, "sourceUrl": image.SourceURL, "author": image.Author, "authorUrl": image.AuthorURL, "license": image.License, "licenseUrl": image.LicenseURL})
	if err != nil {
		return "", err
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO media.asset (owner_user_id, object_key, mime_type, provider, source_url, license, provenance, rights_status, status, updated_at) VALUES ($1,$2,'image/jpeg',$3,$4,$5,$6::jsonb,'pending_review','pending_review',now()) ON CONFLICT (object_key) DO NOTHING RETURNING id::text`, claims.UserID, key, image.Provider, image.SourceURL, image.License, provenance).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `SELECT id::text FROM media.asset WHERE object_key=$1 AND owner_user_id=$2`, key, claims.UserID).Scan(&id)
		return id, err
	}
	if err != nil {
		return "", err
	}
	if image.Provider == "unsplash" {
		if err := tracker.TrackDownload(ctx, image.DownloadLocation); err != nil {
			return "", err
		}
	} else {
		content, mimeType, err := downloadSelectionImage(ctx, image.Provider, image.URL, client)
		if err != nil {
			return "", err
		}
		if err := bucket.WriteAll(ctx, key, content, &blob.WriterOptions{ContentType: mimeType}); err != nil {
			if cleanupErr := bucket.Delete(context.Background(), key); cleanupErr != nil {
				return "", errors.Join(err, cleanupErr)
			}
			return "", err
		}
		if _, err := tx.Exec(ctx, `UPDATE media.asset SET mime_type=$2, byte_size=$3 WHERE id=$1`, id, mimeType, len(content)); err != nil {
			if cleanupErr := bucket.Delete(context.Background(), key); cleanupErr != nil {
				return "", errors.Join(err, cleanupErr)
			}
			return "", err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return id, nil
}

func downloadSelectionImage(ctx context.Context, provider, raw string, client *http.Client) ([]byte, string, error) {
	hosts, ok := rehostedImageHosts[provider]
	if !ok || !selectionURL(raw, hosts...) {
		return nil, "", errors.New("invalid image URL")
	}
	if client == nil {
		client = &http.Client{}
	}
	copyClient := *client
	copyClient.Timeout = 12 * time.Second
	copyClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
	if err != nil {
		return nil, "", err
	}
	response, err := copyClient.Do(req)
	if err != nil {
		return nil, "", errors.New("image download failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, "", errors.New("image download failed")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, localPresignedUploadMaxBytes+1))
	if err != nil || len(data) == 0 || len(data) > localPresignedUploadMaxBytes {
		return nil, "", errors.New("invalid image size")
	}
	mimeType := http.DetectContentType(data)
	if !isSupportedUploadImage(mimeType) {
		return nil, "", errors.New("unsupported image content")
	}
	return data, mimeType, nil
}
