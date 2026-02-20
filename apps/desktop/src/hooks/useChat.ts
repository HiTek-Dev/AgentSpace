import { useState, useCallback, useEffect, useRef } from "react";
import {
	createChatSendMessage,
	type ChatMessage,
	type TextMessage,
	type ToolCallMessage,
} from "../lib/gateway-client";

export interface UseChatOptions {
	send: (msg: object) => void;
	addMessageHandler: (handler: (msg: unknown) => void) => void;
	removeMessageHandler: (handler: (msg: unknown) => void) => void;
	connected: boolean;
	agentId?: string;
}

export interface UseChatReturn {
	messages: ChatMessage[];
	streamingText: string;
	isStreaming: boolean;
	sessionId: string | null;
	model: string | null;
	error: string | null;
	sendMessage: (text: string) => void;
	clearMessages: () => void;
}

/**
 * Chat state management hook with streaming support.
 * Registers a message handler on the WebSocket and processes
 * stream.start, stream.delta, stream.done, and stream.error events.
 */
export function useChat(opts: UseChatOptions): UseChatReturn {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streamingText, setStreamingText] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [model, setModel] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const optsRef = useRef(opts);
	optsRef.current = opts;

	// Register message handler
	useEffect(() => {
		const handler = (msg: unknown) => {
			const m = msg as Record<string, unknown>;
			if (!m || typeof m.type !== "string") return;

			switch (m.type) {
				case "session.created":
					setSessionId(m.sessionId as string);
					break;

				case "chat.stream.start":
					setStreamingText("");
					setIsStreaming(true);
					if (m.model) setModel(m.model as string);
					if (m.sessionId) setSessionId(m.sessionId as string);
					setError(null);
					break;

				case "chat.stream.delta":
					setStreamingText((prev) => prev + (m.delta as string));
					break;

				case "chat.stream.end":
					setStreamingText((current) => {
						if (current) {
							const assistantMsg: TextMessage = {
								id: crypto.randomUUID(),
								type: "text",
								role: "assistant",
								content: current,
								timestamp: new Date().toISOString(),
							};
							setMessages((prev) => [...prev, assistantMsg]);
						}
						return "";
					});
					setIsStreaming(false);
					break;

				case "error":
					setError(m.message as string);
					setStreamingText("");
					setIsStreaming(false);
					break;

				case "tool.call": {
					const toolMsg: ToolCallMessage = {
						id: (m.toolCallId as string) || crypto.randomUUID(),
						type: "tool_call",
						toolName: m.toolName as string,
						input:
							typeof m.args === "string"
								? m.args
								: JSON.stringify(m.args, null, 2),
						status: "pending",
						timestamp: new Date().toISOString(),
					};
					setMessages((prev) => [...prev, toolMsg]);
					break;
				}

				case "tool.result": {
					const tcId = m.toolCallId as string;
					const resultStr =
						typeof m.result === "string"
							? m.result
							: JSON.stringify(m.result, null, 2);
					setMessages((prev) =>
						prev.map((msg) =>
							msg.type === "tool_call" && msg.id === tcId
								? {
										...msg,
										output: resultStr,
										status: "complete" as const,
									}
								: msg,
						),
					);
					break;
				}
			}
		};

		opts.addMessageHandler(handler);
		return () => {
			opts.removeMessageHandler(handler);
		};
	}, [opts.addMessageHandler, opts.removeMessageHandler]);

	const sendMessage = useCallback(
		(text: string) => {
			if (!text.trim()) return;

			// Add user message to local state
			const userMsg: TextMessage = {
				id: crypto.randomUUID(),
				type: "text",
				role: "user",
				content: text,
				timestamp: new Date().toISOString(),
			};
			setMessages((prev) => [...prev, userMsg]);

			// Send to gateway
			const wsMsg = createChatSendMessage(text, {
				sessionId: sessionId ?? undefined,
				agentId: optsRef.current.agentId,
			});
			optsRef.current.send(wsMsg);
		},
		[sessionId],
	);

	const clearMessages = useCallback(() => {
		setMessages([]);
		setStreamingText("");
		setIsStreaming(false);
		setError(null);
	}, []);

	return {
		messages,
		streamingText,
		isStreaming,
		sessionId,
		model,
		error,
		sendMessage,
		clearMessages,
	};
}
