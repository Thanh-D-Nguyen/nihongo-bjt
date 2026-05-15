"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface AmbientState {
  active: boolean;
  sound: "none" | "lofi" | "rain" | "cafe" | "nature";
  volume: number; // 0-100
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

export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AmbientState>({
    active: false,
    sound: "lofi",
    volume: 40,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = useCallback(() => {
    setState((s) => ({ ...s, active: !s.active }));
  }, []);

  const setSound = useCallback((sound: AmbientState["sound"]) => {
    setState((s) => ({ ...s, sound }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState((s) => ({ ...s, volume: Math.max(0, Math.min(100, volume)) }));
  }, []);

  // Audio management
  useEffect(() => {
    if (state.active && state.sound !== "none") {
      const url = SOUND_URLS[state.sound];
      if (!url) return;

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
      }

      if (audioRef.current.src !== url) {
        audioRef.current.src = url;
      }
      audioRef.current.volume = state.volume / 100;
      audioRef.current.play().catch(() => {});
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [state.active, state.sound, state.volume]);

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
