"use client";

import { useEffect, useRef, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch, learnerApiFetchOptional } from "../../../../lib/learner-api";

export interface AdSlotLabels {
  advertisement: string;
  opensInNewTab: string;
  supportMessage: string;
  visitStore: string;
}

interface AdDecision {
  campaignId?: string;
  decisionKey: string;
  eligible: boolean;
  payload?: {
    campaign?: {
      creativeType: string;
      destinationUrl?: string | null;
      id: string;
      name: string;
    };
    providerType?: string;
  };
}

export function isRenderableAdDecision(ad: AdDecision | null): ad is AdDecision {
  const campaign = ad?.payload?.campaign;
  return Boolean(
    ad?.eligible &&
    campaign &&
    campaign.creativeType !== "placeholder" &&
    !campaign.id.startsWith("placeholder:")
  );
}

function clientDevice(): "mobile" | "desktop" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

export function AdSlot({
  className = "",
  labels,
  locale,
  placementCode
}: {
  className?: string;
  labels: AdSlotLabels;
  locale: string;
  placementCode: string;
}) {
  const { userId = "" } = useKeycloakAuth();
  const [ad, setAd] = useState<AdDecision | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const impressionSent = useRef(false);

  useEffect(() => {
    setAd(null);
    impressionSent.current = false;
    if (!userId) return;
    const params = new URLSearchParams({ locale, placementCode, userId });
    const controller = new AbortController();

    void learnerApiFetchOptional(`/api/learner/monetization/ad?${params.toString()}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (response.ok) setAd((await response.json()) as AdDecision);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [locale, placementCode, userId]);

  useEffect(() => {
    if (!userId || !isRenderableAdDecision(ad) || !slotRef.current) return;
    const slot = slotRef.current;

    const sendImpression = () => {
      if (impressionSent.current) return;
      impressionSent.current = true;
      void learnerApiFetch("/api/ads/impression", {
        body: JSON.stringify({
          campaignId: ad.campaignId,
          clientContext: { device: clientDevice(), locale },
          decisionKey: ad.decisionKey,
          kind: "impression",
          placementCode,
          userId
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        keepalive: true
      }).catch(() => undefined);
    };

    if (typeof IntersectionObserver === "undefined") {
      sendImpression();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
          sendImpression();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, [ad, locale, placementCode, userId]);

  if (!isRenderableAdDecision(ad)) return null;

  const campaign = ad.payload!.campaign!;
  const content = (
    <div className="group relative overflow-hidden rounded-2xl border border-ink/10 bg-surface p-4 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.55)] transition duration-200 hover:border-accent/25 hover:shadow-[0_16px_40px_-24px_rgba(15,23,42,0.45)] sm:p-5">
      <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" />
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent sm:h-14 sm:w-14">
          <svg fill="none" height="26" viewBox="0 0 24 24" width="26">
            <path
              d="M4 9.5h16v10H4zM7 9.5V7a5 5 0 0 1 10 0v2.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <path d="M9 13.5h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex rounded-full border border-ink/10 bg-paper px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
            {labels.advertisement}
          </span>
          <p className="mt-1.5 text-base font-black leading-snug text-ink sm:text-lg">
            {campaign.name}
          </p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-muted sm:text-sm">
            {labels.supportMessage}
          </p>
        </div>
        {campaign.destinationUrl ? (
          <span className="hidden min-h-11 shrink-0 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-surface sm:inline-flex">
            {labels.visitStore}
            <span aria-hidden>↗</span>
          </span>
        ) : null}
      </div>
      {campaign.destinationUrl ? (
        <div className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-surface sm:hidden">
          {labels.visitStore}
          <span aria-hidden>↗</span>
        </div>
      ) : null}
    </div>
  );

  const onClick = () => {
    void learnerApiFetch("/api/ads/click", {
      body: JSON.stringify({
        campaignId: ad.campaignId,
        clientContext: { device: clientDevice(), locale },
        decisionKey: ad.decisionKey,
        placementCode,
        userId
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
      keepalive: true
    }).catch(() => undefined);
  };

  return (
    <div className={className} ref={slotRef}>
      {campaign.destinationUrl ? (
        <a
          aria-label={`${campaign.name}. ${labels.opensInNewTab}`}
          className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          href={campaign.destinationUrl}
          onClick={onClick}
          rel="noopener noreferrer sponsored"
          target="_blank"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}
