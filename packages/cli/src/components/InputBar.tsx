import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useInputHistory } from "../hooks/useInputHistory.js";

interface InputBarProps {
	onSubmit: (text: string) => void;
	isStreaming: boolean;
}

/**
 * Custom multiline input bar with history support.
 *
 * - Enter: submit message
 * - Shift+Enter: insert newline
 * - Up/Down arrows (when input empty): cycle message history
 * - Backspace: delete last character
 * - Append-only input (no mid-text cursor movement)
 */
export function InputBar({ onSubmit, isStreaming }: InputBarProps) {
	const [text, setText] = useState("");
	const history = useInputHistory();

	useInput(
		(input, key) => {
			// Enter without Shift: submit
			if (key.return && !key.shift) {
				const trimmed = text.trim();
				if (trimmed) {
					history.push(text);
					onSubmit(trimmed);
					setText("");
				}
				return;
			}

			// Shift+Enter: insert newline
			if (key.return && key.shift) {
				setText((prev) => prev + "\n");
				return;
			}

			// Up arrow when input is empty: cycle history backward
			if (key.upArrow && text === "") {
				const prev = history.back();
				if (prev !== undefined) {
					setText(prev);
				}
				return;
			}

			// Down arrow when input is empty: cycle history forward
			if (key.downArrow && text === "") {
				const next = history.forward();
				setText(next ?? "");
				return;
			}

			// Backspace / delete: remove last character
			if (key.backspace || key.delete) {
				setText((prev) => prev.slice(0, -1));
				return;
			}

			// Regular character input (no ctrl/meta modifiers)
			if (input && !key.ctrl && !key.meta) {
				setText((prev) => prev + input);
			}
		},
		{ isActive: !isStreaming },
	);

	const lines = text.split("\n");
	const isMultiline = lines.length > 1;

	return (
		<Box flexDirection="column">
			<Box>
				<Text bold color="cyan">
					{"> "}
				</Text>
				{isStreaming ? (
					<Text dimColor>streaming...</Text>
				) : (
					<Box flexDirection="column">
						{lines.map((line, i) => (
							<Box key={i}>
								{i > 0 && (
									<Text bold color="cyan">
										{"  "}
									</Text>
								)}
								<Text>
									{line}
									{i === lines.length - 1 && (
										<Text inverse> </Text>
									)}
								</Text>
							</Box>
						))}
					</Box>
				)}
			</Box>
			{!isStreaming && isMultiline && (
				<Text dimColor>  [{lines.length} lines]</Text>
			)}
		</Box>
	);
}
