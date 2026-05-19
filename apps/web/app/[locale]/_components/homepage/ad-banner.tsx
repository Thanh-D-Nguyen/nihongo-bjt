"use client";

import { useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../../lib/learner-api";

interface AdPayload {
  campaign?: {
    creativeType: string;
    destinationUrl?: string;
    id: string;
    name: string;
  };
  config?: Record<string, unknown>;
  labelKey?: string;
  providerKey?: string;
  providerType?: string;
}

interface AdDecisionResponse {
  campaignId?: string;
  decisionKey: string;
  eligible: boolean;
  payload?: AdPayload;
}

export function AdBanner({ locale }: { locale: string }) {
  const auth = useKeycloakAuth();
  const userId = auth.userId ?? "";
  const [ad, setAd] = useState<AdDecisionResponse | null>(null);

  useEffect(() => {
    if (!userId) return;
    void learnerApiFetchOptional(
      `/api/learner/monetization/ad?placementCode=home_feed_banner&userId=${encodeURIComponent(userId)}&locale=${locale}`
    )
      .then(async (r) => {
        if (r?.ok) setAd(await r.json());
      })
      .catch(() => {});
  }, [userId, locale]);

  if (!ad?.eligible) return null;

  const campaign = ad.payload?.campaign;
  const destinationUrl = campaign?.destinationUrl;
  const label = locale === "ja" ? "広告" : "Quảng cáo";

  const content = (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-r from-muted/60 to-muted/30 p-4">
      <span className="absolute right-2 top-2 rounded bg-muted-foreground/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl">
          📢
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {campaign?.name ?? "Sponsored"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {campaign?.creativeType === "placeholder"
              ? locale === "ja"
                ? "スポンサーコンテンツ"
                : "Nội dung tài trợ"
              : campaign?.creativeType ?? "banner"}
          </p>
        </div>
      </div>
    </div>
  );

  if (destinationUrl) {
    return (
      <a
        className="block transition-transform hover:scale-[1.01]"
        href={destinationUrl}
        rel="noopener noreferrer sponsored"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return content;
}
