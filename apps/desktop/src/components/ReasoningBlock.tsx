import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

interface ReasoningBlockProps {
  content: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
}

export function ReasoningBlock({
  content,
  isStreaming = false,
  defaultExpanded = false,
}: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="my-1 rounded border border-muted bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <Brain className="size-3" />
        <span>Reasoning</span>
        {isStreaming && (
          <span className="relative flex size-1.5 ml-1">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
        )}
        {expanded ? (
          <ChevronDown className="ml-auto size-3" />
        ) : (
          <ChevronRight className="ml-auto size-3" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-muted px-3 py-2">
          <p className="whitespace-pre-wrap text-xs italic text-muted-foreground">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}
