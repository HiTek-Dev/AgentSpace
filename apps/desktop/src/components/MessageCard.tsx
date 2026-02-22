import { useState } from "react";
import { Streamdown } from "streamdown";
import { code as CodePlugin } from "@streamdown/code";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import type { ChatMessage } from "@/lib/gateway-client";

interface MessageCardProps {
  message: ChatMessage;
  model?: string | null;
}

const streamdownPlugins = { code: CodePlugin };

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ToolCallCard({
  message,
}: {
  message: Extract<ChatMessage, { type: "tool_call" }>;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    message.status === "completed" ? (
      <Check className="size-3.5 text-green-500" />
    ) : message.status === "error" ? (
      <X className="size-3.5 text-destructive" />
    ) : (
      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
    );

  const argsPreview = message.args
    ? JSON.stringify(message.args).slice(0, 100)
    : "";

  return (
    <Card className="mr-auto max-w-[80%] py-2">
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center gap-2 text-left text-sm"
        >
          {statusIcon}
          <span className="font-mono text-xs font-medium">
            {message.toolName}
          </span>
          {expanded ? (
            <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="ml-auto size-3.5 text-muted-foreground" />
          )}
        </button>

        {!expanded && argsPreview && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {argsPreview}
            {argsPreview.length >= 100 ? "..." : ""}
          </p>
        )}

        {expanded && (
          <div className="mt-2 space-y-2">
            {message.args != null && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Arguments
                </p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(message.args, null, 2)}
                </pre>
              </div>
            )}
            {message.result != null && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Result
                </p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                  {typeof message.result === "string"
                    ? message.result
                    : JSON.stringify(message.result, null, 2)}
                </pre>
              </div>
            )}
            {message.error != null && (
              <div>
                <p className="text-xs font-medium text-destructive">Error</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
                  {message.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MessageCard({ message, model }: MessageCardProps) {
  if (message.type === "tool_approval") {
    // Handled by ToolApprovalModal in Plan 05
    return null;
  }

  if (message.type === "tool_call") {
    return <ToolCallCard message={message} />;
  }

  // Text message
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <Card
      className={cn(
        "max-w-[80%] py-3",
        isUser && "ml-auto",
        !isUser && "mr-auto",
        isSystem && "border-destructive/30 bg-destructive/5",
      )}
    >
      <CardContent className="p-4">
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Streamdown plugins={streamdownPlugins} isAnimating={false}>
              {message.content}
            </Streamdown>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          {model && !isUser && (
            <Badge variant="secondary" className="text-[10px]">
              {model}
            </Badge>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
