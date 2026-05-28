"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { learnerApiFetchOptional } from "../../../../../lib/learner-api";

interface ProfileData {
  id: string;
  displayName: string;
  online: boolean;
  relationship: "self" | "friend" | "stranger" | "blocked" | null;
}

interface Props {
  profile: ProfileData;
  labels: {
    actions: {
      addFriend: string;
      challenge: string;
      friends: string;
      pendingFriend: string;
    };
    challengeSent: string;
    loginToChallenge: string;
    online: string;
  };
  locale: string;
  isAuthenticated: boolean;
}

export function ProfileActions({ profile, labels, locale, isAuthenticated }: Props) {
  const router = useRouter();
  const [challengeState, setChallengeState] = useState<"idle" | "sending" | "sent">("idle");
  const [friendState, setFriendState] = useState<"idle" | "sending" | "sent">(
    profile.relationship === "friend" ? "sent" : "idle"
  );

  if (profile.relationship === "self") return null;
  if (profile.relationship === "blocked") return null;

  const redirectToLogin = () => {
    const returnTo = `/${locale}/u/${profile.id}`;
    router.push(`/${locale}/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleChallenge = async () => {
    if (challengeState !== "idle") return;

    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    setChallengeState("sending");
    router.push(`/${locale}/battle?challenge=${profile.id}`);
    setChallengeState("sent");
  };

  const handleAddFriend = async () => {
    if (friendState !== "idle") return;

    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    setFriendState("sending");

    try {
      const res = await learnerApiFetchOptional("/api/social/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeUserId: profile.id }),
      });

      if (res.ok) {
        setFriendState("sent");
      } else {
        setFriendState("idle");
      }
    } catch {
      setFriendState("idle");
    }
  };

  const challengeLabel = !isAuthenticated
    ? labels.loginToChallenge
    : labels.actions.challenge;

  return (
    <div className="flex flex-wrap items-center gap-3 mt-6">
      {/* Challenge Button — always visible */}
      <button
        onClick={handleChallenge}
        disabled={challengeState === "sending"}
        className={`
          inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm
          shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-150
          min-h-[48px]
          ${challengeState === "sent"
            ? "bg-leaf/10 text-leaf border border-leaf/20 cursor-default"
            : "bg-gradient-to-r from-sakura to-sakura/80 text-white hover:from-sakura/90 hover:to-sakura/70"
          }
          disabled:opacity-60 disabled:cursor-not-allowed
        `}
      >
        {challengeState === "sent" ? (
          <>✓ {labels.challengeSent}</>
        ) : challengeState === "sending" ? (
          <span className="animate-pulse">{challengeLabel}</span>
        ) : (
          <>
            {challengeLabel}
            {/* Online dot indicator */}
            {profile.online && (
              <span className="w-2 h-2 rounded-full bg-leaf animate-pulse" title={labels.online} />
            )}
          </>
        )}
      </button>

      {/* Friend Button — only for authenticated or prompt login */}
      {(profile.relationship === "stranger" || (!isAuthenticated && profile.relationship !== "friend")) && (
        <button
          onClick={handleAddFriend}
          disabled={friendState !== "idle"}
          className={`
            inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm
            min-h-[48px] transition-all duration-150 active:scale-[0.97]
            ${friendState === "sent"
              ? "bg-leaf/10 text-leaf border border-leaf/20 cursor-default"
              : "bg-surface border-2 border-accent/30 text-accent hover:bg-accent/5 hover:border-accent/50 shadow-sm hover:shadow-md"
            }
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        >
          {friendState === "sent" ? (
            <>✓ {labels.actions.pendingFriend}</>
          ) : friendState === "sending" ? (
            <span className="animate-pulse">{labels.actions.addFriend}</span>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {labels.actions.addFriend}
            </>
          )}
        </button>
      )}

      {/* Already friends badge */}
      {profile.relationship === "friend" && (
        <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-leaf/10 text-leaf text-sm font-medium border border-leaf/15">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {labels.actions.friends}
        </span>
      )}
    </div>
  );
}
