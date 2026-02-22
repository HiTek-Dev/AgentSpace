import { tool } from "ai";
import { z } from "zod";

const TodoItemSchema = z.object({
	id: z.string(),
	content: z.string(),
	status: z.enum(["pending", "in_progress", "completed"]),
	activeForm: z
		.string()
		.optional()
		.describe(
			"Present-continuous text shown for in_progress, e.g. 'Fixing bug'",
		),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;

/**
 * Create a todo_write tool that tracks task progress.
 * The onUpdate callback is invoked each time the agent calls the tool,
 * allowing the handler to relay state to connected clients.
 */
export function createTodoWriteTool(
	onUpdate: (todos: TodoItem[]) => void,
) {
	return tool({
		description:
			"Create or update a todo list to track task progress. Replace the entire list each call. Use for multi-step tasks to show progress.",
		inputSchema: z.object({
			todos: z.array(TodoItemSchema).describe("The complete todo list"),
		}),
		execute: async ({ todos }) => {
			onUpdate(todos);
			const completed = todos.filter((t) => t.status === "completed").length;
			return `Updated todos: ${completed}/${todos.length} complete`;
		},
	});
}
