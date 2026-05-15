"use client";

import { useCallback, useState } from "react";
import { learnerApiFetch } from "../../lib/learner-api";

export function useSharePostcard() {
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const share = useCallback(async (endpoint: string, body?: Record<string, unknown>) => {
    if (sharing) return null;
    setSharing(true);
    try {
      const r = await learnerApiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (r.ok) {
        const data = await r.json();
        const url = `${window.location.origin}${data.shareUrl}`;
        setShareUrl(url);

        // Try native share API first, then clipboard
        if (navigator.share) {
          await navigator.share({ url, title: "NihonGo BJT" }).catch(() => {});
        } else {
          await navigator.clipboard.writeText(url);
        }
        return url;
      }
    } catch { /* no-op */ } finally {
      setSharing(false);
    }
    return null;
  }, [sharing]);

  return { share, sharing, shareUrl };
}
