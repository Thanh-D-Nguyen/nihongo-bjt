// Package httpserver provides HTTP handlers for media upload and streaming endpoints.
package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
)

const (
	// maxUploadBytes is the maximum allowed upload size (50 MB).
	maxUploadBytes = 50 << 20

	// streamCacheControl sets caching headers for media streams.
	streamCacheControl = "public, max-age=31536000, immutable"
)

// mediaAssetResponse is the JSON shape returned by upload and metadata endpoints.
type mediaAssetResponse struct {
	ID          string    `json:"id"`
	URL         string    `json:"url"`
	ContentType string    `json:"contentType"`
	SizeBytes   int64     `json:"sizeBytes"`
	CreatedAt   time.Time `json:"createdAt"`
}

// uploadMediaHandler implements POST /api/media/upload.
// Accepts multipart/form-data with field "file". Streams to fileblob storage,
// creates a media.asset row, returns asset metadata JSON.
func uploadMediaHandler(
	store *media.Store,
	bucket *blob.Bucket,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if store == nil || bucket == nil {
			logger.Error("upload-media: media store or bucket nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		if rateLimiter == nil {
			logger.Error("upload-media: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		// Extract learner identity from context (set by LearnerGuard middleware).
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Rate limit by IP.
		peerIP := authn.NormalizePeerIP(r.RemoteAddr)
		ipKey := "ip:media-upload:" + peerIP
		allowed, err := rateLimiter.Allow(ipKey)
		if err != nil || !allowed {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		// Parse multipart form with size limit.
		if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
			if errors.Is(err, http.ErrNotMultipart) || errors.Is(err, http.ErrMissingBoundary) {
				writeJSONError(w, "invalid request: expected multipart/form-data", http.StatusBadRequest)
				return
			}
			// Body too large or parse error.
			writeJSONError(w, "file too large", http.StatusRequestEntityTooLarge)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			if errors.Is(err, http.ErrMissingFile) {
				writeJSONError(w, "missing file field", http.StatusBadRequest)
				return
			}
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Validate file size before streaming.
		if header.Size > maxUploadBytes {
			writeJSONError(w, "file too large", http.StatusRequestEntityTooLarge)
			return
		}

		contentType := header.Header.Get("Content-Type")
		if contentType == "" || contentType == "application/octet-stream" {
			// Fall back to extension-based detection when browser sends generic type.
			if extType := mime.TypeByExtension(filepath.Ext(header.Filename)); extType != "" {
				contentType = extType
			}
		}
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		// Strip parameters (e.g. charset) to store canonical media type only.
		if mediaType, _, err := mime.ParseMediaType(contentType); err == nil && mediaType != "" {
			contentType = mediaType
		}

		originalFilename := filepath.Base(header.Filename)
		if len(originalFilename) > 255 {
			originalFilename = originalFilename[:255]
		}

		ctx := r.Context()

		// Create DB row first to get UUID for storage key.
		assetID, err := store.CreateAssetWithMetadata(ctx, contentType, header.Size, originalFilename, identity.UserID)
		if err != nil {
			logger.Error("upload-media: create asset failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Stream upload to blob storage using asset ID as key.
		storageKey := assetID
		writer, err := bucket.NewWriter(ctx, storageKey, &blob.WriterOptions{
			ContentType: contentType,
		})
		if err != nil {
			logger.Error("upload-media: open blob writer failed", "error", err, "asset_id", assetID)
			// Best-effort cleanup of orphaned DB row.
			_ = store.DeleteAsset(ctx, assetID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		written, err := io.Copy(writer, io.LimitReader(file, maxUploadBytes+1))
		if closeErr := writer.Close(); closeErr != nil {
			logger.Error("upload-media: close blob writer failed", "error", closeErr, "asset_id", assetID)
			_ = store.DeleteAsset(ctx, assetID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err != nil {
			logger.Error("upload-media: stream copy failed", "error", err, "asset_id", assetID)
			_ = bucket.Delete(ctx, storageKey)
			_ = store.DeleteAsset(ctx, assetID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if written > maxUploadBytes {
			_ = bucket.Delete(ctx, storageKey)
			_ = store.DeleteAsset(ctx, assetID)
			writeJSONError(w, "file too large", http.StatusRequestEntityTooLarge)
			return
		}

		// Update size_bytes in case actual streamed bytes differ from header.
		if written != header.Size {
			if err := store.UpdateAssetSize(ctx, assetID, written); err != nil {
				logger.Error("upload-media: update size failed", "error", err, "asset_id", assetID)
				// Non-fatal: asset exists with slightly wrong size metadata.
			}
		}

		resp := mediaAssetResponse{
			ID:          assetID,
			URL:         "/api/media/" + assetID + "/stream",
			ContentType: contentType,
			SizeBytes:   written,
			CreatedAt:   time.Now(), // approximate; DB has precise value
		}

		// Fetch precise created_at from DB.
		asset, err := store.GetAsset(ctx, assetID)
		if err == nil && asset != nil {
			resp.CreatedAt = asset.CreatedAt
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// getMediaMetadataHandler implements GET /api/media/:id.
// Returns asset metadata as JSON. Public (no auth required).
func getMediaMetadataHandler(store *media.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if store == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" || !isValidUUID(id) {
			writeJSONError(w, "invalid asset id", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		asset, err := store.GetAsset(ctx, id)
		if err != nil {
			logger.Error("get-media-metadata: query failed", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if asset == nil {
			writeJSONError(w, "not found", http.StatusNotFound)
			return
		}

		resp := mediaAssetResponse{
			ID:          asset.ID,
			URL:         "/api/media/" + asset.ID + "/stream",
			ContentType: asset.ContentType,
			SizeBytes:   asset.SizeBytes,
			CreatedAt:   asset.CreatedAt,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// streamMediaHandler implements GET /api/media/:id/stream.
// Streams file content from blob storage with Range request support.
// Public access — no auth required.
func streamMediaHandler(store *media.Store, bucket *blob.Bucket, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if store == nil || bucket == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" || !isValidUUID(id) {
			writeJSONError(w, "invalid asset id", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		asset, err := store.GetAsset(ctx, id)
		if err != nil {
			logger.Error("stream-media: query failed", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if asset == nil {
			writeJSONError(w, "not found", http.StatusNotFound)
			return
		}

		reader, err := bucket.NewReader(ctx, asset.StorageKey, nil)
		if err != nil {
			if gcerrors.Code(err) == gcerrors.NotFound {
				writeJSONError(w, "not found", http.StatusNotFound)
				return
			}
			logger.Error("stream-media: open blob reader failed", "error", err, "key", asset.StorageKey)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer reader.Close()

		w.Header().Set("Content-Type", asset.ContentType)
		w.Header().Set("Content-Length", fmt.Sprintf("%d", asset.SizeBytes))
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Cache-Control", streamCacheControl)

		// Inline disposition for images/audio; attachment for others.
		disposition := "inline"
		if !strings.HasPrefix(asset.ContentType, "image/") && !strings.HasPrefix(asset.ContentType, "audio/") {
			disposition = "attachment"
		}
		w.Header().Set("Content-Disposition", disposition)

		http.ServeContent(w, r, asset.StorageKey, asset.CreatedAt, reader)
	}
}
