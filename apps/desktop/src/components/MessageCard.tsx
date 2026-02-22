import { Streamdown } from "streamdown";
import { code as CodePlugin } from "@streamdown/code";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ToolCallCard } from "@/components/ToolCallCard";
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

export function MessageCard({ message, model }: MessageCardProps) {
  if (message.type === "tool_approval") {
    // Handled by ToolApprovalModal
    return null;
  }

  if (message.type === "tool_call") {
    return (
      <ToolCallCard
        toolName={message.toolName}
        args={message.args}
        result={message.result}
        error={message.error}
        status={message.status}
      />
    );
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
