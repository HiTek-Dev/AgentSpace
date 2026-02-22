import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
	connected: boolean;
	model: string;
	usage: {
		totalTokens: number;
		totalCost: number;
	};
	permissionMode?: string;
}

/**
 * Compact single-line status bar pinned at the bottom of the screen.
 * No border, no padding -- a single compact line.
 *
 * Layout: connection dot + model name (left) | token count + cost + permission mode (right)
 */
export function StatusBar({ connected, model, usage, permissionMode }: StatusBarProps) {
	// Shorten model name for display (e.g., "claude-sonnet-4-5-20250929" -> "sonnet-4-5")
	const shortModel = model
		.replace("claude-", "")
		.replace(/-\d{8}$/, "");

	return (
		<Box justifyContent="space-between">
			<Box>
				<Text color={connected ? "green" : "red"}>{"\u25CF "}</Text>
				<Text color="cyan">{shortModel}</Text>
			</Box>
			<Box>
				<Text dimColor>
					{usage.totalTokens.toLocaleString()} tok {"\u00B7"} $
					{usage.totalCost.toFixed(2)}
				</Text>
				{permissionMode && (
					<Text dimColor>{" \u00B7 "}{permissionMode}</Text>
				)}
			</Box>
		</Box>
	);
}
