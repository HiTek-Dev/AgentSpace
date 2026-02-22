import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { diffLines } from "diff";

export interface InlineDiffProps {
	oldText: string;
	newText: string;
	fileName: string;
	isFocused?: boolean;
}

/**
 * Red/green line diff display with collapsible behavior.
 *
 * Uses the `diff` package's diffLines to compute structured changes.
 * Large diffs (>20 changed lines) auto-collapse with a summary.
 * The user can press Enter to toggle expand/collapse when isFocused.
 */
export function InlineDiff({ oldText, newText, fileName, isFocused = false }: InlineDiffProps) {
	const changes = useMemo(() => diffLines(oldText, newText), [oldText, newText]);

	const totalChangedLines = useMemo(() => {
		return changes.reduce((sum, change) => {
			if (change.added || change.removed) {
				return sum + (change.count ?? 0);
			}
			return sum;
		}, 0);
	}, [changes]);

	const autoExpanded = totalChangedLines <= 20;
	const [expanded, setExpanded] = useState(autoExpanded);

	useInput(
		(_input, key) => {
			if (key.return) {
				setExpanded((prev) => !prev);
			}
		},
		{ isActive: isFocused },
	);

	if (!expanded) {
		return (
			<Box>
				<Text color="blue">{"\u270E"} {fileName}</Text>
				<Text dimColor> ({totalChangedLines} lines changed)</Text>
				{isFocused && <Text dimColor> [press Enter to expand]</Text>}
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Box>
				<Text bold color="blue">
					{"\u270E"} {fileName}
				</Text>
				{isFocused && <Text dimColor> [Enter to collapse]</Text>}
			</Box>
			{changes.map((change, i) => {
				if (!change.added && !change.removed) {
					// Skip unchanged context lines to reduce noise
					return null;
				}
				const lines = change.value.split("\n");
				// diffLines includes trailing newline, trim last empty element
				if (lines.length > 0 && lines[lines.length - 1] === "") {
					lines.pop();
				}
				return lines.map((line, j) => (
					<Text
						key={`${i}-${j}`}
						color={change.added ? "green" : "red"}
					>
						{change.added ? "+ " : "- "}
						{line}
					</Text>
				));
			})}
		</Box>
	);
}
