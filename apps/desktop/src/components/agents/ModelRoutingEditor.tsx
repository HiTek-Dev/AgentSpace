import { useEffect, useState } from "react";
import { Loader2, Save, Route } from "lucide-react";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import { useAvailableModels } from "@/hooks/useAvailableModels";
import {
  createAgentIdentityRead,
  createAgentIdentityWrite,
  type AgentIdentityReadResult,
  type ServerMessage,
} from "@/lib/gateway-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModelRoutingEditorProps {
  agentId: string;
}

const TASK_TYPES = [
  {
    key: "research",
    label: "Research",
    description: "Web searches, information gathering, and analysis",
  },
  {
    key: "code_generation",
    label: "Code Generation",
    description: "Writing, editing, and refactoring code",
  },
  {
    key: "planning",
    label: "Planning",
    description: "Task decomposition, project planning, and strategy",
  },
  {
    key: "general_chat",
    label: "General Chat",
    description: "Conversational responses and general Q&A",
  },
  {
    key: "summarization",
    label: "Summarization",
    description: "Condensing documents, threads, and content",
  },
] as const;

type TaskKey = (typeof TASK_TYPES)[number]["key"];

const ROUTING_FILE = "ROUTING.md";

/** Parse a ROUTING.md file back into routing state. */
function parseRoutingMarkdown(md: string): Partial<Record<TaskKey, string>> {
  const result: Partial<Record<TaskKey, string>> = {};
  const lines = md.split("\n");
  let currentTask: string | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^## (.+)$/);
    if (sectionMatch) {
      // Convert section heading back to task key (e.g. "Code Generation" -> "code_generation")
      const label = sectionMatch[1]!.trim();
      const task = TASK_TYPES.find((t) => t.label === label);
      currentTask = task ? task.key : null;
      continue;
    }
    const modelMatch = line.match(/^Model:\s*(.+)$/);
    if (modelMatch && currentTask) {
      result[currentTask as TaskKey] = modelMatch[1]!.trim();
      currentTask = null;
    }
  }
  return result;
}

/** Format routing state as a ROUTING.md markdown file. */
function formatRoutingMarkdown(routing: Record<TaskKey, string>): string {
  const sections = TASK_TYPES
    .filter((task) => routing[task.key])
    .map((task) => `## ${task.label}\nModel: ${routing[task.key]}`);

  if (sections.length === 0) {
    return "# Model Routing\n\nNo task-specific routing configured.\n";
  }
  return `# Model Routing\n\n${sections.join("\n\n")}\n`;
}

export function ModelRoutingEditor({ agentId }: ModelRoutingEditorProps) {
  const { request, connected } = useGatewayRpc();
  const { models: availableModels } = useAvailableModels();

  const dynamicModelOptions = [
    { value: "", label: "Default (use agent model)" },
    ...availableModels.map((m) => ({
      value: m.modelId,
      label: m.label,
    })),
  ];

  const [routing, setRouting] = useState<Record<TaskKey, string>>({
    research: "",
    code_generation: "",
    planning: "",
    general_chat: "",
    summarization: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing routing on mount
  useEffect(() => {
    if (!connected) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    request<AgentIdentityReadResult>(createAgentIdentityRead(agentId, ROUTING_FILE))
      .then((res) => {
        if (cancelled) return;
        if (res.exists && res.content) {
          const parsed = parseRoutingMarkdown(res.content);
          setRouting((prev) => ({ ...prev, ...parsed }));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load routing");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, connected, request]);

  const handleChange = (taskKey: TaskKey, model: string) => {
    setRouting((prev) => ({ ...prev, [taskKey]: model }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!connected) return;

    setSaving(true);
    setError(null);

    try {
      const content = formatRoutingMarkdown(routing);
      const res = await request<ServerMessage>(
        createAgentIdentityWrite(agentId, ROUTING_FILE, content),
      );

      if ("success" in res && res.success) {
        setSaved(true);
      } else if ("error" in res && typeof res.error === "string") {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save routing");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Model Routing
          </h3>
          {saved && (
            <span className="text-xs text-emerald-400">Configuration saved</span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving || !connected}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save Routing
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Map task types to specific models. When a task type is detected, the
        assigned model will be used instead of the agent&apos;s default model.
      </p>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading routing...</span>
        </div>
      )}

      {/* Routing table */}
      <div className="flex flex-col gap-3">
        {TASK_TYPES.map((task) => (
          <div
            key={task.key}
            className={cn(
              "flex items-center justify-between gap-4 rounded-lg border border-input bg-card p-4",
              "dark:bg-input/10",
            )}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {task.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {task.description}
              </span>
            </div>

            <select
              value={routing[task.key]}
              onChange={(e) =>
                handleChange(task.key as TaskKey, e.target.value)
              }
              className={cn(
                "h-9 w-56 shrink-0 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "dark:bg-input/30",
              )}
            >
              {dynamicModelOptions.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-card text-foreground"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Info footer */}
      <div className="mt-auto rounded-md border border-input/50 bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          Tasks without an assigned model will use the agent&apos;s default model.
          The routing engine evaluates incoming messages and selects the
          appropriate model based on the detected task type.
        </p>
      </div>
    </div>
  );
}
