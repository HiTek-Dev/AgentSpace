import { homeDir, join } from "@tauri-apps/api/path";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";

export interface RuntimeInfo {
  pid: number;
  port: number;
  startedAt: string;
}

/**
 * Discover a running Tek gateway by reading ~/.config/tek/runtime.json
 * and validating with a health check.
 *
 * Returns RuntimeInfo if gateway is running, null if not found or stale.
 */
export async function discoverGateway(): Promise<RuntimeInfo | null> {
  try {
    const home = await homeDir();
    const path = await join(home, ".config", "tek", "runtime.json");

    const fileExists = await exists(path);
    if (!fileExists) {
      return null;
    }

    const content = await readTextFile(path);
    const data = JSON.parse(content) as RuntimeInfo;

    if (!data.port || !data.pid) {
      return null;
    }

    // Health check to detect stale runtime.json (gateway crashed without cleanup).
    // If it fails due to CORS (Tauri dev webview), still trust the file —
    // a stale file is cleaned up on gateway exit, and the WS connection
    // will fail fast if the gateway isn't actually running.
    try {
      const res = await fetch(`http://127.0.0.1:${data.port}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) {
        return null;
      }
    } catch {
      // CORS or network error — trust runtime.json, WS will validate
    }

    return {
      pid: data.pid,
      port: data.port,
      startedAt: data.startedAt,
    };
  } catch {
    return null;
  }
}
