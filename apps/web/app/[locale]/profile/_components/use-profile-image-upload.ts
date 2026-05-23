"use client";

import { useCallback, useState } from "react";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface UploadState {
  uploading: boolean;
  error: string | null;
}

/**
 * Hook for uploading profile images (avatar/cover) via the presign-upload flow.
 * Returns assetId on success, null on failure.
 */
export function useProfileImageUpload() {
  const [state, setState] = useState<UploadState>({ uploading: false, error: null });

  const upload = useCallback(async (file: File): Promise<string | null> => {
    setState({ uploading: true, error: null });
    try {
      // 1. Request presigned URL
      const presignRes = await learnerApiFetch("/api/media/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
        }),
      });
      if (!presignRes.ok) {
        throw new Error("presign_failed");
      }
      const { assetId, uploadUrl } = await presignRes.json();

      // 2. Upload file directly to storage (MinIO presigned PUT)
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("storage_upload_failed");
      }

      // 3. Complete upload (verify + set byte size)
      const completeRes = await learnerApiFetch("/api/media/complete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          byteSize: file.size,
        }),
      });
      if (!completeRes.ok) {
        throw new Error("complete_failed");
      }

      setState({ uploading: false, error: null });
      return assetId as string;
    } catch {
      setState({ uploading: false, error: "upload_failed" });
      return null;
    }
  }, []);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  return { ...state, upload, clearError };
}
