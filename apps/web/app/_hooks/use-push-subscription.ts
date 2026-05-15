"use client";

import { useCallback, useEffect, useState } from "react";
import { learnerApiFetch } from "../../lib/learner-api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushSubscription(userId: string | null) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    if (!supported) {
      setLoading(false);
      return;
    }

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const subscribe = useCallback(async () => {
    if (!userId) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    try {
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });

      const keys = sub.toJSON().keys as { p256dh: string; auth: string };
      await learnerApiFetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: { endpoint: sub.endpoint, keys },
        }),
      });
      setIsSubscribed(true);
    } catch (e) {
      console.warn("Push subscribe failed:", e);
    }
  }, [userId]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await learnerApiFetch("/api/notifications/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (e) {
      console.warn("Push unsubscribe failed:", e);
    }
  }, []);

  return { isSubscribed, isSupported, loading, subscribe, unsubscribe };
}
