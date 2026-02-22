import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../lib/gateway-client.js";
import { MarkdownRenderer } from "./MarkdownRenderer.js";
import { InlineToolCall } from "./InlineToolCall.js";

interface MessageBubbleProps {
	message: ChatMessage;
}

/** Format an ISO timestamp to HH:MM. */
function formatTimestamp(iso: string): string {
	const d = new Date(iso);
	const h = String(d.getHours()).padStart(2, "0");
	const m = String(d.getMinutes()).padStart(2, "0");
	return `${h}:${m}`;
}

/**
 * Renders a single chat message with type-based styling.
 * - text/user: cyan prompt indicator with plain text
 * - text/assistant: magenta header with full markdown rendering
 * - text/system: dimmed yellow for system/error messages
 * - tool_call: blue tool header with input/output (Phase 6)
 * - bash_command: green terminal-style display (Phase 6)
 * - reasoning: dimmed italic thinking trace (Phase 6)
 *
 * All messages display a dimmed HH:MM timestamp right-aligned.
 * Tool and bash output is truncated at 20 lines.
 */
export function MessageBubble({ message }: MessageBubbleProps) {
	const ts = <Text dimColor>{"  "}{formatTimestamp(message.timestamp)}</Text>;

	switch (message.type) {
		case "text": {
			switch (message.role) {
				case "user":
					return (
						<Box marginBottom={1} flexDirection="column">
							<Box justifyContent="space-between" width="100%">
								<Box>
									<Text bold color="cyan">
										{"> "}
									</Text>
									<Text>{message.content}</Text>
								</Box>
								{ts}
							</Box>
						</Box>
					);
				case "assistant":
					return (
						<Box flexDirection="column" marginBottom={1}>
							<Box justifyContent="space-between" width="100%">
								<Text bold color="magenta">
									{"* Assistant"}
								</Text>
								{ts}
							</Box>
							<MarkdownRenderer content={message.content} />
						</Box>
					);
				case "system":
					return (
						<Box marginBottom={1}>
							<Box justifyContent="space-between" width="100%">
								<Text color="yellow" dimColor>
									{"! "}
									{message.content}
								</Text>
								{ts}
							</Box>
						</Box>
					);
			}
			break;
		}

		case "tool_call": {
			return (
				<Box>
					<Box justifyContent="space-between" width="100%">
						<InlineToolCall
							toolName={message.toolName}
							status={message.status}
							input={message.input}
						/>
						{ts}
					</Box>
				</Box>
			);
		}

		case "bash_command": {
			const bashStatus: "pending" | "complete" | "error" =
				message.exitCode === undefined
					? "pending"
					: message.exitCode === 0
						? "complete"
						: "error";
			return (
				<Box>
					<Box justifyContent="space-between" width="100%">
						<InlineToolCall
							toolName="bash_command"
							status={bashStatus}
							input={message.command}
						/>
						{ts}
					</Box>
				</Box>
			);
		}

		case "reasoning": {
			const preview = message.content.length > 80
				? message.content.slice(0, 77) + "..."
				: message.content;
			return (
				<Box>
					<Box justifyContent="space-between" width="100%">
						<Text dimColor italic>{"~ "}{preview}</Text>
						{ts}
					</Box>
				</Box>
			);
		}

		case "sources": {
			const items = message.sources
				.map((s, i) => `  [${i + 1}] ${s.title || s.url}`)
				.join("\n");
			return (
				<Box marginBottom={1}>
					<Text dimColor>{"Sources:\n"}{items}</Text>
				</Box>
			);
		}
	}
}
