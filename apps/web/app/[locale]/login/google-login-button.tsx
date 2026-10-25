"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGoAuth } from "../../../lib/go-auth-provider";

type GoogleAccounts = {
  accounts: { id: {
    initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }) => void;
    renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; locale: string }) => void;
  } };
};

const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
export const googleLoginEnabled = Boolean(clientId);

export function GoogleLoginButton({ locale, destination, label, onError }: {
  locale: string;
  destination: string;
  label: string;
  onError: (status: number) => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const router = useRouter();
  const { reload } = useGoAuth();

  useEffect(() => {
    if (!googleLoginEnabled || !clientId) return;
    const getGoogle = () => (window as Window & { google?: GoogleAccounts }).google;
    let active = true;
    const loadButton = () => {
      const google = getGoogle();
      if (!active || !google || !target.current) return;
      target.current.replaceChildren();
      google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async ({ credential }) => {
          if (busyRef.current) return;
          busyRef.current = true;
          setBusy(true);
          try {
            const response = await fetch("/api/auth/google", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: credential })
            });
            if (!response.ok) { onError(response.status); return; }
            await reload();
            router.replace(destination);
          } catch {
            onError(0);
          } finally {
            busyRef.current = false;
            if (active) setBusy(false);
          }
        }
      });
      google.accounts.id.renderButton(target.current, { theme: "outline", size: "large", width: 320, locale });
    };

    const scriptId = "google-identity-services";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (getGoogle()) loadButton();
    else {
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", loadButton);
    }
    return () => { active = false; script?.removeEventListener("load", loadButton); };
  }, [locale, destination, onError, reload, router]);

  if (!googleLoginEnabled) return null;
  return (
    <div className="flex min-h-[48px] flex-col items-center justify-center gap-2" aria-busy={busy}>
      <div ref={target} role="group" aria-label={label} />
    </div>
  );
}
