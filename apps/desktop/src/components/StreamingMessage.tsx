import { Streamdown } from "streamdown";
import { code as CodePlugin } from "@streamdown/code";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StreamingMessageProps {
  text: string;
  isStreaming: boolean;
  model?: string | null;
}

const streamdownPlugins = { code: CodePlugin };

export function StreamingMessage({
  text,
  isStreaming,
  model,
}: StreamingMessageProps) {
  return (
    <Card className="mr-auto max-w-[80%] py-3">
      <CardContent className="p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Streamdown plugins={streamdownPlugins} isAnimating={isStreaming}>
            {text}
          </Streamdown>
        </div>

        <div className="mt-2 flex items-center gap-2">
          {isStreaming && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          )}
          {model && (
            <Badge variant="secondary" className="text-[10px]">
              {model}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
