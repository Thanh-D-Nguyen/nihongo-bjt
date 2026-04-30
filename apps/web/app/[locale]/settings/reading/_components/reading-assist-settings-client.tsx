"use client";

import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { AnnotatedJapaneseText, type ReadingAssistDisplayMode } from "../../../../../components/reading-assist/annotated-japanese-text";
import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";

type Messages = {
  userIdLabel: string;
  userIdPlaceholder: string;
  displayModeLabel: string;
  modeOff: string;
  modeHover: string;
  modeDifficult: string;
  modeFull: string;
  modeBeginner: string;
  savePrefs: string;
  prefsSaved: string;
  prefsError: string;
  demoLabel: string;
  demoText: string;
  examLabel: string;
  demoIntro: string;
  annotated: {
    addCardAction: string;
    addCardError: string;
    addCardNoDeck: string;
    addCardSuccess: string;
    bottomSheetClose: string;
    errorHttp: string;
    errorNetwork: string;
    errorTimeout: string;
    furiganaLabel: string;
    lexemeLine: string;
    loadingText: string;
    meaningLabel: string;
    posLabel: string;
    retryAction: string;
    serviceUnavailable: string;
  };
};

type Props = {
  labels: Messages;
};

export function ReadingAssistSettingsClient({ labels }: Props) {
  const { userId } = useKeycloakAuth();
  const [displayMode, setDisplayMode] = useState<ReadingAssistDisplayMode>("hover");
  const [examTimed, setExamTimed] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);

  const loadPrefs = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      return;
    }
    const r = await learnerApiFetch(
      `/api/reading-assist/preferences?userId=${encodeURIComponent(uid)}`
    );
    if (r.ok) {
      const j = (await r.json()) as { displayMode: ReadingAssistDisplayMode; showRomaji: boolean };
      if (j.displayMode) {
        setDisplayMode(j.displayMode);
      }
    }
  }, [userId]);

  const savePrefs = useCallback(async () => {
    setPrefsMessage(null);
    const uid = userId;
    if (!uid) {
      setPrefsMessage(labels.prefsError);
      return;
    }
    const r = await learnerApiFetch("/api/reading-assist/preferences", {
      body: JSON.stringify({ displayMode, userId: uid }),
      headers: { "content-type": "application/json" },
      method: "PUT"
    });
    if (!r.ok) {
      setPrefsMessage(labels.prefsError);
      return;
    }
    setPrefsMessage(labels.prefsSaved);
  }, [displayMode, labels.prefsError, labels.prefsSaved, userId]);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader description={labels.demoIntro} title={labels.demoLabel} />
      <Card className="border-ink/10 shadow-sm">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink">{labels.displayModeLabel}</span>
            <select
              className="max-w-md rounded-xl border border-ink/12 bg-surface px-3 py-2 text-sm"
              onChange={(e) => setDisplayMode(e.target.value as ReadingAssistDisplayMode)}
              value={displayMode}
            >
              <option value="off">{labels.modeOff}</option>
              <option value="hover">{labels.modeHover}</option>
              <option value="difficult">{labels.modeDifficult}</option>
              <option value="full_furigana">{labels.modeFull}</option>
              <option value="beginner">{labels.modeBeginner}</option>
            </select>
          </label>

          <button
            className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90"
            onClick={() => void savePrefs()}
            type="button"
          >
            {labels.savePrefs}
          </button>
          {prefsMessage ? <p className="text-sm text-muted">{prefsMessage}</p> : null}

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              checked={examTimed}
              onChange={(e) => setExamTimed(e.target.checked)}
              type="checkbox"
            />
            <span>{labels.examLabel}</span>
          </label>

          {userId ? (
            <div className="border-t border-ink/10 pt-6" lang="ja">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {labels.demoText}
              </p>
              <AnnotatedJapaneseText
                analyzePath="/api/reading-assist/analyze"
                analyticsPath="/api/reading-assist/analytics"
                displayMode={displayMode}
                examTimed={examTimed}
                labels={labels.annotated}
                text="念のため確認させてください。"
                userId={userId}
              />
            </div>
          ) : (
            <p className="text-sm text-muted">{labels.userIdLabel}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
