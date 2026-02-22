import React from "react";
import { Box, Text, useStdout } from "ink";

/**
 * Thin horizontal rule divider using box-drawing character.
 * Fills the full terminal width with a dimmed line.
 */
export function Divider() {
	const { stdout } = useStdout();
	const width = stdout?.columns ?? 80;

	return (
		<Box>
			<Text dimColor>{"\u2500".repeat(width)}</Text>
		</Box>
	);
}
