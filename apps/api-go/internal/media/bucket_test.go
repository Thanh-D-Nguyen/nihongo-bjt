package media

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"gocloud.dev/blob"
)

func TestBucketWritesTemporaryFilesOnMediaFilesystem(t *testing.T) {
	mediaDir := t.TempDir()
	tempDir := t.TempDir()
	t.Setenv("TMPDIR", tempDir)
	bucket, err := OpenBucket(mediaDir)
	if err != nil {
		t.Fatal(err)
	}
	defer bucket.Close()
	w, err := bucket.NewWriter(context.Background(), "images/test.jpg", &blob.WriterOptions{ContentType: "image/jpeg"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write([]byte("image data")); err != nil {
		t.Fatal(err)
	}
	files, err := os.ReadDir(filepath.Join(mediaDir, "images"))
	if err != nil || len(files) == 0 {
		t.Fatalf("temporary file must be created on the media filesystem: files=%v err=%v", files, err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	got, err := bucket.ReadAll(context.Background(), "images/test.jpg")
	if err != nil || string(got) != "image data" {
		t.Fatalf("saved image: got %q, err %v", got, err)
	}
}
