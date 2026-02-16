import React from "react";
import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";

interface InputBarProps {
	onSubmit: (text: string) => void;
	isStreaming: boolean;
}

/**
 * Text input bar with a prompt indicator and streaming state awareness.
 * Disabled during streaming to prevent concurrent sends.
 */
export function InputBar({ onSubmit, isStreaming }: InputBarProps) {
	return (
		<Box>
			<Text bold color="cyan">
				{"> "}
			</Text>
			{isStreaming ? (
				<Text dimColor>streaming...</Text>
			) : (
				<TextInput
					placeholder="Send a message..."
					onSubmit={(value) => {
						const trimmed = value.trim();
						if (trimmed) {
							onSubmit(trimmed);
						}
					}}
				/>
			)}
		</Box>
	);
}
