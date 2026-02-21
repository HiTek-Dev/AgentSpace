import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { truncateOutput } from "../lib/truncate.js";

interface ToolPanelProps {
	toolName: string;
	status: "pending" | "complete" | "error";
	input: string;
	output?: string;
	isFocused?: boolean;
}

const STATUS_ICONS: Record<ToolPanelProps["status"], { icon: string; color: string }> = {
	pending: { icon: "\u22EF", color: "yellow" },   // ⋯
	complete: { icon: "\u2713", color: "green" },    // ✓
	error: { icon: "\u2717", color: "red" },         // ✗
};

/**
 * Interactive collapsible tool panel for the LIVE render region.
 * Shows a one-line summary by default; press Enter to expand/collapse.
 * NOT for use inside <Static> — uses useState and useInput.
 */
export function ToolPanel({ toolName, status, input, output, isFocused = false }: ToolPanelProps) {
	const [expanded, setExpanded] = useState(false);

	useInput(
		(_input, key) => {
			if (key.return) {
				setExpanded((prev) => !prev);
			}
		},
		{ isActive: isFocused },
	);

	const { icon, color } = STATUS_ICONS[status];
	const chevron = expanded ? "\u25BC" : "\u25B6"; // ▼ or ▶

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text>{chevron} </Text>
				<Text bold color="blue">
					{toolName}
				</Text>
				<Text> </Text>
				<Text color={color}>{icon}</Text>
			</Box>
			{expanded && (
				<Box flexDirection="column" marginLeft={2}>
					<Text dimColor>{input}</Text>
					{output && <Text>{truncateOutput(output)}</Text>}
				</Box>
			)}
		</Box>
	);
}
