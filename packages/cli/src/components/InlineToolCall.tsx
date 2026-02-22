import React from "react";
import { Box, Text } from "ink";

const TOOL_ICONS: Record<string, { icon: string; color: string }> = {
	bash_command: { icon: "\u25B6", color: "green" }, // triangle right
	read_file: { icon: "\u25CF", color: "cyan" }, // filled circle
	write_file: { icon: "\u270E", color: "blue" }, // pencil
	update_file: { icon: "\u270E", color: "blue" }, // pencil
	web_search: { icon: "\u25C6", color: "magenta" }, // diamond
	skill_register: { icon: "\u2605", color: "yellow" }, // star
	todo_write: { icon: "\u2610", color: "white" }, // ballot box
	default: { icon: "\u25C7", color: "gray" }, // diamond outline
};

export interface InlineToolCallProps {
	toolName: string;
	status: "pending" | "complete" | "error";
	input?: string;
	output?: string;
	args?: unknown;
}

/**
 * Compact inline tool call display for the conversation flow.
 *
 * Renders a single line: [icon] toolName(argPreview) [statusIcon]
 * For bash_command type, renders: $ command [statusIcon]
 */
export function InlineToolCall({ toolName, status, input }: InlineToolCallProps) {
	const { icon, color } = TOOL_ICONS[toolName] ?? TOOL_ICONS.default;

	const statusIcon =
		status === "complete" ? (
			<Text color="green">{"\u2713"}</Text>
		) : status === "error" ? (
			<Text color="red">{"\u2717"}</Text>
		) : (
			<Text color="yellow">{"\u22EF"}</Text>
		);

	// Extract a short argument preview from input
	const argPreview = input
		? input.length > 40
			? input.slice(0, 37) + "..."
			: input
		: "";

	// Bash commands render as "$ command" style
	if (toolName === "bash_command") {
		const cmdPreview = argPreview || "";
		return (
			<Box gap={1}>
				<Text bold color="green">
					{"$"}
				</Text>
				<Text dimColor>{cmdPreview}</Text>
				{statusIcon}
			</Box>
		);
	}

	// All other tools: [icon] toolName(argPreview) [statusIcon]
	return (
		<Box gap={1}>
			<Text color={color}>{icon}</Text>
			<Text bold color="blue">
				{toolName}
			</Text>
			{argPreview ? <Text dimColor>{"("}{argPreview}{")"}</Text> : null}
			{statusIcon}
		</Box>
	);
}
