import { nanoid } from "nanoid";
import type { ClientMessage } from "@agentspace/gateway";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: string;
}

/** Create a chat.send message for the gateway WebSocket protocol. */
export function createChatSendMessage(
	content: string,
	opts?: { sessionId?: string; model?: string },
): ClientMessage {
	return {
		type: "chat.send",
		id: nanoid(),
		content,
		...opts,
	};
}

/** Create a context.inspect message for the gateway WebSocket protocol. */
export function createContextInspectMessage(
	sessionId: string,
): ClientMessage {
	return {
		type: "context.inspect",
		id: nanoid(),
		sessionId,
	};
}

/** Create a usage.query message for the gateway WebSocket protocol. */
export function createUsageQueryMessage(sessionId?: string): ClientMessage {
	return {
		type: "usage.query",
		id: nanoid(),
		sessionId,
	};
}

/** Create a session.list message for the gateway WebSocket protocol. */
export function createSessionListMessage(): ClientMessage {
	return {
		type: "session.list",
		id: nanoid(),
	};
}
