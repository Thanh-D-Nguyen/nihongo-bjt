"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook that detects user's motion preference and limits concurrent
 * animations accordingly. Implements WCAG 2.1 SC 2.3.3 compliance.
 *
 * Usage:
 *   const { prefersReducedMotion, shouldAnimate, activeAnimations } = useReducedMotion();
 *   if (shouldAnimate) { ... trigger animation ... }
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const activeAnimationsRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /** Max 3 concurrent animations (even when motion is allowed) */
  const MAX_CONCURRENT = 3;
  const shouldAnimate = !prefersReducedMotion && activeAnimationsRef.current < MAX_CONCURRENT;

  const registerAnimation = () => {
    activeAnimationsRef.current += 1;
  };
  const unregisterAnimation = () => {
    activeAnimationsRef.current = Math.max(0, activeAnimationsRef.current - 1);
  };

  return {
    prefersReducedMotion,
    shouldAnimate,
    activeAnimations: activeAnimationsRef.current,
    registerAnimation,
    unregisterAnimation,
  };
}

/**
 * Utility to get appropriate animation duration based on user preference.
 * Returns 0 for reduced motion, or the specified duration otherwise.
 */
export function getAnimationDuration(baseMs: number, prefersReduced: boolean): number {
  return prefersReduced ? 0 : baseMs;
}

/**
 * Focus-visible utility classnames. Use with Tailwind `focus-visible:` variant
 * for keyboard-only focus rings (not mouse clicks).
 *
 * Standard focus ring: 2px ring with offset, accessible contrast.
 */
export const FOCUS_VISIBLE_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Announce a message to screen readers via an aria-live region.
 * Creates a temporary element that self-destructs after announcement.
 */
export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite") {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.setAttribute("aria-live", priority);
  el.setAttribute("aria-atomic", "true");
  el.setAttribute("role", priority === "assertive" ? "alert" : "status");
  el.className = "sr-only";
  document.body.appendChild(el);
  // Delay to ensure the live region is registered before content is added
  setTimeout(() => {
    el.textContent = message;
    setTimeout(() => el.remove(), 1000);
  }, 100);
}
