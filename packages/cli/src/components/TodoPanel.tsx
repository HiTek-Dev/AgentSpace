import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import type { TodoItem } from "../hooks/useChat.js";

interface TodoPanelProps {
	todos: TodoItem[];
}

/**
 * Claude Code-style tree display for todos with colored status icons.
 *
 * Status icons:
 * - completed: heavy check mark (green)
 * - in_progress: spinner (keep existing)
 * - pending: white circle (dimmed)
 *
 * Tree lines: vertical box drawing for all but last, corner for last item.
 */
export function TodoPanel({ todos }: TodoPanelProps) {
	if (todos.length === 0) {
		return null;
	}

	const completed = todos.filter((t) => t.status === "completed").length;

	return (
		<Box flexDirection="column" marginTop={1}>
			<Text bold dimColor>
				Tasks ({completed}/{todos.length})
			</Text>
			{todos.map((todo, index) => {
				const isLast = index === todos.length - 1;
				const treeLine = isLast ? "\u2514 " : "\u2502 ";

				return (
					<Box key={todo.id} gap={1}>
						<Text dimColor>{"  "}{treeLine}</Text>
						{todo.status === "completed" && (
							<Text color="green">{"\u2714"}</Text>
						)}
						{todo.status === "in_progress" && <Spinner label="" />}
						{todo.status === "pending" && (
							<Text dimColor>{"\u25CB"}</Text>
						)}
						<Text
							dimColor={todo.status === "completed"}
							strikethrough={todo.status === "completed"}
							bold={todo.status === "in_progress"}
						>
							{todo.status === "in_progress"
								? (todo.activeForm || todo.content)
								: todo.content}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
