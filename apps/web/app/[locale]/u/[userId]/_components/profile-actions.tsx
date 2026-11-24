"use client";

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

export function ProfileActions(props: Props) {
  const { profile, labels } = props;

  if (profile.relationship !== "friend") return null;

  return (
    <div className="flex flex-wrap items-center gap-3 mt-6">
      {/* Already friends badge (PvP challenge button hidden under WEB-443) */}
      <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-leaf/10 text-leaf text-sm font-medium border border-leaf/15">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        {labels.actions.friends}
      </span>
    </div>
  );
}
