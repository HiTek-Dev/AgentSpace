import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

const MAX_ROWS = 6;
const LINE_HEIGHT = 20; // approximate px per row
const MIN_HEIGHT = LINE_HEIGHT + 16; // 1 row + padding
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT + 16;

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset height to auto to get the actual scrollHeight
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = `${MIN_HEIGHT}px`;
      }
    });
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isEmpty = value.trim().length === 0;

  return (
    <div className="flex items-end gap-2 border-t bg-background p-4">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
        className="min-h-0 resize-none"
        rows={1}
        style={{ height: MIN_HEIGHT }}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={isEmpty || disabled}
        className="shrink-0"
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}
