import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { useChat } from "@/hooks/useChat";
import { useConfig } from "@/hooks/useConfig";
import { MessageList } from "@/components/MessageList";
import { ChatInput } from "@/components/ChatInput";
import { AgentSelector, type Agent } from "@/components/AgentSelector";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

export function ChatView() {
  const port = useAppStore((s) => s.gateway.port);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const setSelectedAgentId = useAppStore((s) => s.setSelectedAgentId);

  const { config } = useConfig();

  const {
    messages,
    streamingText,
    isStreaming,
    currentModel,
    usage,
    sendMessage,
    wsStatus,
  } = useChat({ port, agentId: selectedAgentId });

  // Derive agent list from config
  const agents: Agent[] = config?.agents?.list ?? [];

  // Agent auto-selection logic
  useEffect(() => {
    if (selectedAgentId) return; // Already selected
    if (agents.length === 1) {
      setSelectedAgentId(agents[0].id);
    } else if (agents.length > 1 && config?.agents?.defaultAgentId) {
      setSelectedAgentId(config.agents.defaultAgentId);
    }
  }, [agents, selectedAgentId, setSelectedAgentId, config]);

  const wsConnected = wsStatus === "connected";

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: agent selector + status info */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <AgentSelector
          agents={agents}
          selectedId={selectedAgentId}
          onSelect={setSelectedAgentId}
        />

        <div className="flex items-center gap-2">
          {/* Model / token info */}
          {currentModel && (
            <Badge variant="outline" className="text-[10px]">
              {currentModel}
            </Badge>
          )}
          {usage && (
            <span className="text-[10px] text-muted-foreground">
              {usage.totalTokens.toLocaleString()} tokens
            </span>
          )}

          {/* WebSocket connection status */}
          {wsConnected ? (
            <Wifi className="size-3.5 text-green-500" />
          ) : (
            <WifiOff className="size-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Message list (flex-1, scrollable) */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          model={currentModel}
        />
      </div>

      {/* Chat input (fixed at bottom) */}
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
