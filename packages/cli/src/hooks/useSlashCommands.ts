import { useCallback } from "react";
import { nanoid } from "nanoid";
import type { ClientMessage } from "@agentspace/gateway";
import type { ChatMessage } from "../lib/gateway-client.js";
import {
	createUsageQueryMessage,
	createSessionListMessage,
	createContextInspectMessage,
} from "../lib/gateway-client.js";

export type SlashCommandResult = {
	handled: boolean;
	message?: ChatMessage;
	wsMessage?: ClientMessage;
	action?: "clear" | "quit" | "help" | "model-switch";
	/** Extracted model name for model-switch action */
	modelName?: string;
};

interface SlashCommandContext {
	sessionId: string | null;
	model: string;
}

function systemMessage(content: string): ChatMessage {
	return {
		id: nanoid(),
		type: "text",
		role: "system",
		content,
		timestamp: new Date().toISOString(),
	};
}

const HELP_TEXT = [
	"/model <name>    Switch model",
	"/session new     New session",
	"/session list    List sessions",
	"/context         Inspect context",
	"/usage           Show usage stats",
	"/clear           Clear screen",
	"/quit            Exit",
	"/help            Show this help",
].join("\n");

/**
 * Hook for parsing and dispatching slash commands.
 * Returns processInput which checks if input is a slash command.
 */
export function useSlashCommands() {
	const processInput = useCallback(
		(input: string, context: SlashCommandContext): SlashCommandResult => {
			if (!input.startsWith("/")) {
				return { handled: false };
			}

			const parts = input.slice(1).split(/\s+/);
			const command = parts[0]?.toLowerCase();
			const args = parts.slice(1);

			switch (command) {
				case "help":
					return {
						handled: true,
						action: "help",
						message: systemMessage(HELP_TEXT),
					};

				case "model": {
					const name = args.join(" ").trim();
					if (!name) {
						return {
							handled: true,
							message: systemMessage(
								`Current model: ${context.model}\nUsage: /model <name>`,
							),
						};
					}
					return {
						handled: true,
						action: "model-switch",
						modelName: name,
						message: systemMessage(`Switched to model: ${name}`),
					};
				}

				case "session": {
					const sub = args[0]?.toLowerCase();
					if (sub === "new") {
						return {
							handled: true,
							message: systemMessage("Starting new session..."),
						};
					}
					if (sub === "list") {
						return {
							handled: true,
							wsMessage: createSessionListMessage(),
						};
					}
					return {
						handled: true,
						message: systemMessage(
							"Usage: /session new | /session list",
						),
					};
				}

				case "context": {
					if (!context.sessionId) {
						return {
							handled: true,
							message: systemMessage(
								"No active session. Send a message first.",
							),
						};
					}
					return {
						handled: true,
						wsMessage: createContextInspectMessage(context.sessionId),
					};
				}

				case "usage":
					return {
						handled: true,
						wsMessage: createUsageQueryMessage(
							context.sessionId ?? undefined,
						),
					};

				case "clear":
					return { handled: true, action: "clear" };

				case "quit":
				case "exit":
					return { handled: true, action: "quit" };

				default:
					return {
						handled: true,
						message: systemMessage(
							`Unknown command: /${command}. Type /help for available commands.`,
						),
					};
			}
		},
		[],
	);

	return { processInput };
}
