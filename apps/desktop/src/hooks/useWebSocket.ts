import { useCallback, useEffect, useRef, useState } from 'react';
import WebSocket from '@tauri-apps/plugin-websocket';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketParams {
  url: string;
  onMessage: (data: string) => void;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  status: WebSocketStatus;
  send: (data: string) => void;
  reconnect: () => void;
}

const INITIAL_DELAY = 1000;
const MAX_DELAY = 30_000;

/**
 * WebSocket hook using Tauri's plugin-websocket (not browser WebSocket).
 * Provides auto-reconnect with exponential backoff (1s -> 2s -> 4s -> 8s -> 16s -> 30s max).
 */
export function useWebSocket({ url, onMessage, enabled = true }: UseWebSocketParams): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');

  // Refs to avoid stale closures
  const wsRef = useRef<Awaited<ReturnType<typeof WebSocket.connect>> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_DELAY);
  const reconnectAttemptRef = useRef(0);
  const enabledRef = useRef(enabled);
  const urlRef = useRef(url);
  const onMessageRef = useRef(onMessage);

  // Keep refs in sync
  enabledRef.current = enabled;
  urlRef.current = url;
  onMessageRef.current = onMessage;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    clearReconnectTimer();
    if (wsRef.current) {
      try {
        await wsRef.current.disconnect();
      } catch {
        // Ignore disconnect errors (already closed)
      }
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [clearReconnectTimer]);

  const connect = useCallback(async () => {
    if (!enabledRef.current || !urlRef.current) return;

    // Close existing connection before creating new one
    if (wsRef.current) {
      try {
        await wsRef.current.disconnect();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }

    setStatus('connecting');

    try {
      const ws = await WebSocket.connect(urlRef.current);
      wsRef.current = ws;

      // Reset backoff on successful connection
      reconnectDelayRef.current = INITIAL_DELAY;
      reconnectAttemptRef.current = 0;
      setStatus('connected');

      ws.addListener((msg) => {
        if (typeof msg === 'object' && msg !== null) {
          // Tauri WebSocket plugin message format
          if ('type' in msg && msg.type === 'Close') {
            // Connection closed by server
            wsRef.current = null;
            setStatus('disconnected');
            scheduleReconnect();
            return;
          }
          if ('data' in msg && typeof msg.data === 'string') {
            onMessageRef.current(msg.data);
            return;
          }
          // Handle Text variant: { type: 'Text', data: string }
          if ('type' in msg && msg.type === 'Text' && 'data' in msg && typeof msg.data === 'string') {
            onMessageRef.current(msg.data);
            return;
          }
        }
        // If raw string (shouldn't happen with Tauri plugin, but handle defensively)
        if (typeof msg === 'string') {
          onMessageRef.current(msg);
        }
      });
    } catch {
      wsRef.current = null;
      setStatus('error');
      scheduleReconnect();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!enabledRef.current) return;
    clearReconnectTimer();

    const delay = Math.min(reconnectDelayRef.current, MAX_DELAY);
    reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      // Exponential backoff: double delay for next attempt
      reconnectDelayRef.current = Math.min(delay * 2, MAX_DELAY);
      connect();
    }, delay);
  }, [clearReconnectTimer, connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current) {
      wsRef.current.send(data);
    }
  }, []);

  const reconnect = useCallback(() => {
    // Manual reconnect: reset backoff
    reconnectDelayRef.current = INITIAL_DELAY;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    connect();
  }, [clearReconnectTimer, connect]);

  // Connect/disconnect on enabled/url changes
  useEffect(() => {
    if (enabled && url) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url]);

  return { status, send, reconnect };
}
