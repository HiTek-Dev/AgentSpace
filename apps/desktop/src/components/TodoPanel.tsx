import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

export function TodoPanel({ todos }: { todos: TodoItem[] }) {
  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === "completed").length;

  return (
    <div className="shrink-0 border-t px-4 py-2 space-y-1">
      <div className="text-xs text-muted-foreground">
        Tasks ({completed}/{todos.length})
      </div>
      {todos.map((todo) => (
        <div key={todo.id} className="flex items-center gap-2 text-sm">
          {todo.status === "completed" && (
            <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          )}
          {todo.status === "in_progress" && (
            <Loader2 className="size-3.5 text-blue-500 animate-spin shrink-0" />
          )}
          {todo.status === "pending" && (
            <Circle className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <span
            className={
              todo.status === "completed"
                ? "line-through text-muted-foreground"
                : ""
            }
          >
            {todo.status === "in_progress"
              ? todo.activeForm || todo.content
              : todo.content}
          </span>
        </div>
      ))}
    </div>
  );
}
