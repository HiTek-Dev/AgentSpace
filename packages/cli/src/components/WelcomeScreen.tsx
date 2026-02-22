import React from "react";
import { Box, Text } from "ink";
import { DISPLAY_NAME } from "@tek/core";

/**
 * Welcome screen shown when the chat is empty (no messages yet).
 * Displays the agent name, available slash commands, and keyboard shortcuts.
 */
export function WelcomeScreen() {
	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				{DISPLAY_NAME}
			</Text>
			<Text dimColor>
				Type a message to start chatting, or use a command:
			</Text>
			<Text>{""}</Text>
			<Text>{"  /help     Show all commands"}</Text>
			<Text>{"  /model    Switch model"}</Text>
			<Text>{"  /swap     Switch by alias"}</Text>
			<Text>{"  /proxy    Run terminal app"}</Text>
			<Text>{""}</Text>
			<Text dimColor>
				Enter to send · Shift+Enter for newline · ↑/↓ for history
			</Text>
		</Box>
	);
}
