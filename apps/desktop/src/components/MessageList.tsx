import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowDown } from "lucide-react";
import { MessageCard } from "@/components/MessageCard";
import { StreamingMessage } from "@/components/StreamingMessage";
import type { ChatMessage } from "@/lib/gateway-client";

interface MessageListProps {
  messages: ChatMessage[];
  streamingText: string;
  streamingReasoning?: string;
  isStreaming: boolean;
  model?: string | null;
}

const NEAR_BOTTOM_THRESHOLD = 100;

export function MessageList({
  messages,
  streamingText,
  streamingReasoning,
  isStreaming,
  model,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Check if user is near the bottom of the scroll container
  const checkNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance < NEAR_BOTTOM_THRESHOLD;
    setIsNearBottom(near);
    setShowScrollButton(!near);
  }, []);

  // Auto-scroll to bottom when near bottom and new content arrives
  useEffect(() => {
    if (isNearBottom) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    } else if (messages.length > 0 || (isStreaming && streamingText)) {
      // New content arrived while scrolled up -- show button
      setShowScrollButton(true);
    }
  }, [messages.length, streamingText, isStreaming, isNearBottom]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setIsNearBottom(true);
      setShowScrollButton(false);
    }
  }, []);

  // Empty state
  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <MessageSquare className="size-10 opacity-30" />
        <p className="text-sm">Start a conversation</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div
        ref={scrollRef}
        className="flex h-full flex-col gap-3 overflow-y-auto p-4"
        onScroll={checkNearBottom}
      >
        {messages.map((msg) => (
          <MessageCard key={msg.id} message={msg} model={model} />
        ))}

        {isStreaming && (streamingText || streamingReasoning) && (
          <StreamingMessage
            text={streamingText}
            reasoning={streamingReasoning}
            isStreaming={isStreaming}
            model={model}
          />
        )}

        {/* Scroll-to-bottom button */}
        {showScrollButton && (
          <div className="sticky bottom-2 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full shadow-md"
              onClick={scrollToBottom}
            >
              <ArrowDown className="mr-1 size-3.5" />
              Scroll to bottom
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
