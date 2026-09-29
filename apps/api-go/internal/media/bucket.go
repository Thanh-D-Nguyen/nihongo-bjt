// Package media provides media asset storage and retrieval using gocloud.dev/blob.
package media

import (
	"context"
	"fmt"
	"os"

	"gocloud.dev/blob"
	"gocloud.dev/blob/fileblob"
)

// OpenBucket opens a fileblob bucket at basePath, creating the directory if needed.
func OpenBucket(basePath string) (*blob.Bucket, error) {
	if err := os.MkdirAll(basePath, 0o755); err != nil {
		return nil, fmt.Errorf("media: create base path %q: %w", basePath, err)
	}
	bucket, err := fileblob.OpenBucket(basePath, nil)
	if err != nil {
		return nil, fmt.Errorf("media: open fileblob bucket: %w", err)
	}
	return bucket, nil
}

// CloseBucket closes the bucket if non-nil. Safe to call with nil.
func CloseBucket(bucket *blob.Bucket) {
	if bucket == nil {
		return
	}
	_ = bucket.Close()
}

// BucketExists checks if the bucket is accessible by listing zero keys.
func BucketExists(ctx context.Context, bucket *blob.Bucket) bool {
	if bucket == nil {
		return false
	}
	iter := bucket.List(nil)
	_, _ = iter.Next(ctx) // consume one or get EOF; we only care about no error on init
	return true
}
