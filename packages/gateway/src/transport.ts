import type { WebSocket } from "ws";
import type { ServerMessage } from "./ws/protocol.js";

/**
 * Transport abstracts message delivery to a client.
 * WebSocket and Telegram each implement this interface.
 */
export interface Transport {
	/** Send a typed server message to the client */
	send(msg: ServerMessage): void;
	/** Unique identifier for this transport (for connection state keying) */
	readonly transportId: string;
	/** Channel type identifier */
	readonly channel: "ws" | "telegram";
}

/**
 * WebSocketTransport wraps a raw WebSocket connection as a Transport.
 * This preserves existing WebSocket behavior while enabling channel-agnostic handlers.
 */
export class WebSocketTransport implements Transport {
	readonly channel = "ws" as const;
	readonly transportId: string;

	constructor(
		private ws: WebSocket,
		id: string,
	) {
		this.transportId = `ws:${id}`;
	}

	send(msg: ServerMessage): void {
		if (this.ws.readyState === this.ws.OPEN) {
			this.ws.send(JSON.stringify(msg));
		}
	}

	/** Access underlying WebSocket (for close event binding only) */
	get raw(): WebSocket {
		return this.ws;
	}
}
