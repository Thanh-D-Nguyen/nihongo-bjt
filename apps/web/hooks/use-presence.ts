"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { useKeycloakAuth } from "../components/auth/keycloak-auth-provider";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");
const HEARTBEAT_INTERVAL_MS = 60_000; // 60s (server TTL is 90s)

export type ChallengeReceivedPayload = {
  challengeId: string;
  fromDisplayName: string | null;
  fromUserId: string;
  targetUserId: string;
};

type PresenceOptions = {
  onChallengeReceived?: (payload: ChallengeReceivedPayload) => void;
};

/**
 * Connects to the /presence WebSocket namespace when the user is authenticated.
 * Sends periodic heartbeats to keep the user marked as "online".
 * Auto-disconnects on logout or unmount.
 */
export function usePresence(options?: PresenceOptions) {
  const { accessToken } = useKeycloakAuth();
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onChallengeRef = useRef(options?.onChallengeReceived);
  onChallengeRef.current = options?.onChallengeReceived;

  useEffect(() => {
    if (!accessToken) {
      // Disconnect if token is gone (logout)
      socketRef.current?.disconnect();
      socketRef.current = null;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    // Already connected with this token
    if (socketRef.current?.connected) return;

    const socket = io(`${API_URL}/presence`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socket.on("connect", () => {
      // Start heartbeat
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        socket.emit("presence:heartbeat");
      }, HEARTBEAT_INTERVAL_MS);
    });

    socket.on("disconnect", () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    });

    // Listen for challenge notifications forwarded via presence namespace
    socket.on("battle:user_challenge_received", (payload: ChallengeReceivedPayload) => {
      onChallengeRef.current?.(payload);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [accessToken]);
}
