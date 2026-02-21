import React from "react";
import { Box, Text } from "ink";
import { DISPLAY_NAME } from "@tek/core";

interface StatusBarProps {
	connected: boolean;
	sessionId: string | null;
	model: string;
	usage: {
		totalTokens: number;
		totalCost: number;
	};
}

/**
 * Compact single-line status bar with three zones: connection + name, model, usage.
 * No border — saves 2 vertical lines compared to the old bordered layout.
 */
export function StatusBar({ connected, model, usage }: StatusBarProps) {
	// Shorten model name for display (e.g., "claude-sonnet-4-5-20250929" -> "sonnet-4-5")
	const shortModel = model
		.replace("claude-", "")
		.replace(/-\d{8}$/, "");

	return (
		<Box justifyContent="space-between">
			<Box>
				<Text color={connected ? "green" : "red"}>{"● "}</Text>
				<Text bold>{DISPLAY_NAME}</Text>
			</Box>
			<Text color="cyan">{shortModel}</Text>
			<Text dimColor>
				{usage.totalTokens.toLocaleString()} tok · $
				{usage.totalCost.toFixed(2)}
			</Text>
		</Box>
	);
}
