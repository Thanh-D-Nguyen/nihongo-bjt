"use client";

import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { usePushSubscription } from "../../../_hooks/use-push-subscription";

export interface PushBannerLabels {
  prompt: string;
  enable: string;
  dismiss: string;
  error: string;
}

const DISMISS_KEY = "push_prompt_dismissed";

export function PushPromptBanner({ labels }: { labels: PushBannerLabels }) {
  const { userId } = useKeycloakAuth();
  const { isSubscribed, isSupported, loading, subscribe } = usePushSubscription(userId);
  const [dismissed, setDismissed] = useState(true); // start hidden
  const [error, setError] = useState(false);

  useEffect(() => {
    const d = localStorage.getItem(DISMISS_KEY);
    setDismissed(d === "1");
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  const handleSubscribe = useCallback(async () => {
    setError(false);
    try {
      await subscribe();
      dismiss();
    } catch {
      setError(true);
    }
  }, [subscribe, dismiss]);

  if (!userId || loading || !isSupported || isSubscribed || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-ink">
          <span className="mr-1.5">🔔</span>
          {labels.prompt}
        </p>
        {error && (
          <p className="text-xs text-sakura">{labels.error}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void handleSubscribe()}
          className="inline-flex min-h-8 items-center rounded-lg bg-accent px-3 text-xs font-bold text-white transition hover:opacity-90 active:scale-[0.95]"
        >
          {labels.enable}
        </button>
        <button
          onClick={dismiss}
          className="text-xs text-muted hover:text-ink"
          aria-label={labels.dismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
