import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";
import type { TodoItem } from "../hooks/useChat.js";

interface TodoPanelProps {
	todos: TodoItem[];
}

export function TodoPanel({ todos }: TodoPanelProps) {
	if (todos.length === 0) {
		return null;
	}

	const completed = todos.filter((t) => t.status === "completed").length;

	return (
		<Box flexDirection="column" marginTop={1}>
			<Text dimColor>Tasks ({completed}/{todos.length})</Text>
			{todos.map((todo) => (
				<Box key={todo.id} gap={1}>
					{todo.status === "completed" && <Text color="green">+</Text>}
					{todo.status === "in_progress" && <Spinner label="" />}
					{todo.status === "pending" && <Text dimColor>o</Text>}
					<Text
						dimColor={todo.status === "completed"}
						strikethrough={todo.status === "completed"}
					>
						{todo.status === "in_progress"
							? (todo.activeForm || todo.content)
							: todo.content}
					</Text>
				</Box>
			))}
		</Box>
	);
}
