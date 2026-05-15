"use client";

import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { usePushSubscription } from "../../../_hooks/use-push-subscription";

export function PushPromptBanner() {
  const { userId } = useKeycloakAuth();
  const { isSubscribed, isSupported, loading, subscribe } = usePushSubscription(userId);
  const [dismissed, setDismissed] = useState(true); // start hidden

  useEffect(() => {
    const d = sessionStorage.getItem("push_prompt_dismissed");
    setDismissed(d === "1");
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem("push_prompt_dismissed", "1");
    setDismissed(true);
  }, []);

  const handleSubscribe = useCallback(async () => {
    await subscribe();
    dismiss();
  }, [subscribe, dismiss]);

  if (!userId || loading || !isSupported || isSubscribed || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
      <p className="text-sm text-ink">
        <span className="mr-1.5">🔔</span>
        Nhận thông báo Kanji mỗi ngày?
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void handleSubscribe()}
          className="inline-flex min-h-8 items-center rounded-lg bg-accent px-3 text-xs font-bold text-white transition hover:opacity-90 active:scale-[0.95]"
        >
          Bật
        </button>
        <button
          onClick={dismiss}
          className="text-xs text-muted hover:text-ink"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
