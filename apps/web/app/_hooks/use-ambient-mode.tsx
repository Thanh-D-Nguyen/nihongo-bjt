"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface AmbientState {
  active: boolean;
  sound: "none" | "lofi" | "rain" | "cafe" | "nature";
  volume: number; // 0-100
  error: boolean;
}

interface AmbientContextValue extends AmbientState {
  toggle: () => void;
  setSound: (sound: AmbientState["sound"]) => void;
  setVolume: (volume: number) => void;
}

const AmbientContext = createContext<AmbientContextValue>({
  active: false,
  sound: "none",
  volume: 40,
  error: false,
  toggle: () => {},
  setSound: () => {},
  setVolume: () => {},
});

// Free ambient sound URLs (royalty-free, no API key needed)
const SOUND_URLS: Record<string, string> = {
  lofi: "https://cdn.pixabay.com/audio/2024/11/28/audio_3710a73c1e.mp3",
  rain: "https://cdn.pixabay.com/audio/2022/05/16/audio_460b0e5765.mp3",
  cafe: "https://cdn.pixabay.com/audio/2024/02/22/audio_e39ab3e4e5.mp3",
  nature: "https://cdn.pixabay.com/audio/2022/03/17/audio_636d9aadd1.mp3",
};

function getOrCreateAudio(ref: React.MutableRefObject<HTMLAudioElement | null>) {
  if (!ref.current) {
    ref.current = new Audio();
    ref.current.loop = true;
    ref.current.preload = "none";
  }
  return ref.current;
}

export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AmbientState>({
    active: false,
    sound: "lofi",
    volume: 40,
    error: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play audio — must be called from user-gesture context (click handler)
  const playAudio = useCallback((sound: string, volume: number) => {
    const url = SOUND_URLS[sound];
    if (!url) return;
    const audio = getOrCreateAudio(audioRef);
    if (audio.src !== url) {
      audio.src = url;
    }
    audio.volume = volume / 100;
    audio.play().then(() => {
      setState((s) => ({ ...s, error: false }));
    }).catch(() => {
      setState((s) => ({ ...s, error: true, active: false }));
    });
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  // Toggle must trigger play directly (user gesture)
  const toggle = useCallback(() => {
    setState((s) => {
      const next = !s.active;
      if (next && s.sound !== "none") {
        // Play immediately in click context
        playAudio(s.sound, s.volume);
      } else {
        pauseAudio();
      }
      return { ...s, active: next, error: false };
    });
  }, [playAudio, pauseAudio]);

  // setSound must also trigger play directly (user gesture)
  const setSound = useCallback((sound: AmbientState["sound"]) => {
    setState((s) => {
      if (s.active && sound !== "none") {
        playAudio(sound, s.volume);
      } else if (sound === "none") {
        pauseAudio();
      }
      return { ...s, sound };
    });
  }, [playAudio, pauseAudio]);

  const setVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(100, volume));
    if (audioRef.current) {
      audioRef.current.volume = clamped / 100;
    }
    setState((s) => ({ ...s, volume: clamped }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <AmbientContext.Provider value={{ ...state, toggle, setSound, setVolume }}>
      {children}
    </AmbientContext.Provider>
  );
}

export function useAmbientMode() {
  return useContext(AmbientContext);
}
