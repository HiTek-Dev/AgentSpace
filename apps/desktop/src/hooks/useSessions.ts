import { useState, useEffect, useCallback } from 'react';
import { createSessionListMessage } from '../lib/gateway-client';

export interface Session {
  sessionId: string;
  sessionKey: string;
  model: string;
  createdAt: string;
  messageCount: number;
}

export function useSessions(
  send: (msg: object) => void,
  addMessageHandler: (handler: (msg: unknown) => void) => void,
  removeMessageHandler: (handler: (msg: unknown) => void) => void,
  connected: boolean,
) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    send(createSessionListMessage());
  }, [connected, send]);

  useEffect(() => {
    const handler = (msg: unknown) => {
      const m = msg as Record<string, unknown>;
      if (
        (m?.type === 'session.list' || m?.type === 'session.list.response') &&
        Array.isArray(m.sessions)
      ) {
        setSessions(m.sessions as Session[]);
        setLoading(false);
      }
    };
    addMessageHandler(handler);
    return () => removeMessageHandler(handler);
  }, [addMessageHandler, removeMessageHandler]);

  // Fetch on mount when connected
  useEffect(() => {
    if (connected) refresh();
  }, [connected, refresh]);

  return { sessions, loading, refresh };
}
