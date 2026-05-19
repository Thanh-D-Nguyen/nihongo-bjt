"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type AmbientSound = "none" | "lofi" | "rain" | "cafe" | "nature";

interface AmbientState {
  active: boolean;
  sound: AmbientSound;
  volume: number; // 0-100
  error: boolean;
}

interface AmbientContextValue extends AmbientState {
  toggle: () => void;
  setSound: (sound: AmbientSound) => void;
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

interface AmbientEngine {
  context: AudioContext;
  master: GainNode;
  nodes: AudioNode[];
  timers: number[];
}

type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function createAudioContext() {
  const AudioContextCtor = window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("Web Audio API is not available.");
  }
  return new AudioContextCtor();
}

function createNoiseBuffer(context: AudioContext) {
  const bufferSize = context.sampleRate * 2;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function addLoopingNoise(engine: AmbientEngine, options: { gain: number; frequency: number; type: BiquadFilterType }) {
  const source = engine.context.createBufferSource();
  const filter = engine.context.createBiquadFilter();
  const gain = engine.context.createGain();

  source.buffer = createNoiseBuffer(engine.context);
  source.loop = true;
  filter.type = options.type;
  filter.frequency.value = options.frequency;
  filter.Q.value = 0.7;
  gain.gain.value = options.gain;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(engine.master);
  source.start();

  engine.nodes.push(source, filter, gain);
}

function addDrone(engine: AmbientEngine, frequency: number, gainValue: number, type: OscillatorType = "sine") {
  const oscillator = engine.context.createOscillator();
  const gain = engine.context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;

  oscillator.connect(gain);
  gain.connect(engine.master);
  oscillator.start();

  engine.nodes.push(oscillator, gain);
}

function addPulse(engine: AmbientEngine, frequency: number, gainValue: number, everyMs: number) {
  const play = () => {
    const oscillator = engine.context.createOscillator();
    const gain = engine.context.createGain();
    const now = engine.context.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    oscillator.connect(gain);
    gain.connect(engine.master);
    oscillator.start(now);
    oscillator.stop(now + 0.85);
  };

  play();
  engine.timers.push(window.setInterval(play, everyMs));
}

function stopEngine(engine: AmbientEngine | null) {
  if (!engine) return;
  for (const timer of engine.timers) {
    window.clearInterval(timer);
  }
  for (const node of engine.nodes) {
    if ("stop" in node && typeof node.stop === "function") {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    }
    node.disconnect();
  }
  void engine.context.close();
}

function createAmbientEngine(sound: AmbientSound, volume: number) {
  const context = createAudioContext();
  const master = context.createGain();
  const engine: AmbientEngine = { context, master, nodes: [], timers: [] };

  master.gain.value = volume / 100;
  master.connect(context.destination);

  if (sound === "lofi") {
    addDrone(engine, 174, 0.05, "sine");
    addDrone(engine, 261.63, 0.025, "triangle");
    addPulse(engine, 329.63, 0.035, 2400);
    addPulse(engine, 392, 0.025, 3600);
  } else if (sound === "rain") {
    addLoopingNoise(engine, { gain: 0.16, frequency: 1800, type: "bandpass" });
    addLoopingNoise(engine, { gain: 0.06, frequency: 350, type: "lowpass" });
  } else if (sound === "cafe") {
    addLoopingNoise(engine, { gain: 0.06, frequency: 420, type: "lowpass" });
    addPulse(engine, 220, 0.018, 3200);
    addPulse(engine, 554.37, 0.012, 5100);
  } else if (sound === "nature") {
    addLoopingNoise(engine, { gain: 0.08, frequency: 900, type: "highpass" });
    addDrone(engine, 136.1, 0.025, "sine");
    addPulse(engine, 880, 0.014, 4300);
    addPulse(engine, 1174.66, 0.01, 6700);
  }

  return engine;
}

export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AmbientState>({
    active: false,
    sound: "lofi",
    volume: 40,
    error: false,
  });
  const engineRef = useRef<AmbientEngine | null>(null);

  const playAudio = useCallback((sound: AmbientSound, volume: number) => {
    if (sound === "none") return;
    try {
      stopEngine(engineRef.current);
      const engine = createAmbientEngine(sound, volume);
      engineRef.current = engine;
      void engine.context.resume();
      setState((s) => ({ ...s, error: false }));
    } catch {
      setState((s) => ({ ...s, error: true, active: false }));
    }
  }, []);

  const pauseAudio = useCallback(() => {
    stopEngine(engineRef.current);
    engineRef.current = null;
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
  const setSound = useCallback((sound: AmbientSound) => {
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
    if (engineRef.current) {
      engineRef.current.master.gain.value = clamped / 100;
    }
    setState((s) => ({ ...s, volume: clamped }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEngine(engineRef.current);
      engineRef.current = null;
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
