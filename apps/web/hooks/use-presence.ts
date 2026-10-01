"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { useGoAuth } from "../lib/go-auth-provider";

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
 *
 * Go-native auth uses HttpOnly session cookies — no Bearer token needed.
 * Cookies are sent automatically on the WebSocket upgrade request.
 */
export function usePresence(options?: PresenceOptions) {
  const { isAuthenticated, userId } = useGoAuth();
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onChallengeRef = useRef(options?.onChallengeReceived);
  onChallengeRef.current = options?.onChallengeReceived;

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      // Disconnect if user logged out
      socketRef.current?.disconnect();
      socketRef.current = null;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    // Already connected
    if (socketRef.current?.connected) return;

    const socket = io(`${API_URL}/presence`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      withCredentials: true,
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
  }, [isAuthenticated, userId]);
}