import React, { useCallback, useState } from "react";
import { Box } from "ink";
import { useApp } from "ink";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useChat } from "../hooks/useChat.js";
import { useSlashCommands } from "../hooks/useSlashCommands.js";
import {
	createChatSendMessage,
	createToolApprovalResponse,
	createPreflightApprovalResponse,
} from "../lib/gateway-client.js";
import { FullScreenWrapper } from "./FullScreenWrapper.js";
import { ConversationScroll } from "./ConversationScroll.js";
import { Divider } from "./Divider.js";
import { StreamingResponse } from "./StreamingResponse.js";
import { InputBar } from "./InputBar.js";
import { StatusBar } from "./StatusBar.js";
import { ToolPanel } from "./ToolPanel.js";
import { ToolApprovalPrompt } from "./ToolApprovalPrompt.js";
import { SkillApprovalPrompt } from "./SkillApprovalPrompt.js";
import { PreflightChecklist } from "./PreflightChecklist.js";
import { TodoPanel } from "./TodoPanel.js";

interface ChatProps {
	wsUrl: string;
	initialModel?: string;
	resumeSessionId?: string;
	agentId?: string;
	onProxyRequest?: (command: string, args: string[], agent: boolean) => void;
}

/**
 * Full chat interface component with fullscreen layout.
 *
 * Layout structure:
 *   FullScreenWrapper (alternate screen buffer)
 *     ConversationScroll (flexGrow=1, windowed messages)
 *       WelcomeScreen | MessageBubbles | StreamingResponse | TodoPanel | ToolPanel | Approvals
 *     Divider (thin horizontal rule)
 *     InputBar (bordered, fixed at bottom, cursor-aware editing)
 *     StatusBar (single compact line at very bottom)
 */
export function Chat({ wsUrl, initialModel, resumeSessionId, agentId, onProxyRequest }: ChatProps) {
	const { exit } = useApp();

	const {
		messages,
		streamingText,
		streamingReasoning,
		isStreaming,
		sessionId,
		model,
		connected,
		usage,
		pendingApproval,
		pendingPreflight,
		handleServerMessage,
		addUserMessage,
		addMessage,
		clearMessages,
		setConnected,
		setModel,
		setSessionId,
		approveToolCall,
		approvePreflight,
		todos,
		toolCalls,
	} = useChat({ initialModel, resumeSessionId });

	const { send } = useWebSocket({
		url: wsUrl,
		onMessage: handleServerMessage,
		onClose: useCallback(() => setConnected(false), [setConnected]),
	});

	const { processInput } = useSlashCommands();

	// Track input height for layout calculation (border=2 + content lines + hint=1)
	const [inputContentLines, setInputContentLines] = useState(1);

	const handleSubmit = useCallback(
		(input: string) => {
			const result = processInput(input, { sessionId, model });

			if (result.handled) {
				// Add any result message to the chat
				if (result.message) {
					addMessage(result.message);
				}

				// Send any WebSocket message
				if (result.wsMessage) {
					send(result.wsMessage);
				}

				// Handle actions
				if (result.action === "quit") {
					exit();
					return;
				}
				if (result.action === "clear") {
					clearMessages();
					return;
				}
				if (result.action === "model-switch" && result.modelName) {
					setModel(result.modelName);
					return;
				}
				if (
					result.action === "proxy" &&
					result.proxyCommand &&
					onProxyRequest
				) {
					onProxyRequest(result.proxyCommand, result.proxyArgs ?? [], result.proxyAgent ?? false);
					exit();
					return;
				}
				if (input.startsWith("/session") && input.includes("new")) {
					setSessionId(null);
					return;
				}
				return;
			}

			// Regular chat message
			addUserMessage(input);
			send(
				createChatSendMessage(input, {
					sessionId: sessionId ?? undefined,
					model,
					agentId,
				}),
			);
		},
		[
			processInput,
			sessionId,
			model,
			agentId,
			addMessage,
			addUserMessage,
			send,
			exit,
			clearMessages,
			setModel,
			setSessionId,
			onProxyRequest,
		],
	);

	const handleToolApproval = useCallback(
		(approved: boolean, sessionApprove?: boolean) => {
			if (pendingApproval) {
				const response = approveToolCall(approved, sessionApprove);
				send(
					createToolApprovalResponse(
						pendingApproval.toolCallId,
						response.approved,
						response.sessionApprove,
					),
				);
			}
		},
		[pendingApproval, approveToolCall, send],
	);

	const handlePreflightApproval = useCallback(
		(approved: boolean) => {
			if (pendingPreflight) {
				const response = approvePreflight(approved);
				if (response.requestId) {
					send(
						createPreflightApprovalResponse(
							response.requestId,
							response.approved,
						),
					);
				}
			}
		},
		[pendingPreflight, approvePreflight, send],
	);

	// Determine if input should be active (not during streaming or approvals)
	const isInputActive = !isStreaming && !pendingApproval && !pendingPreflight;

	return (
		<FullScreenWrapper>
			{({ width, height }) => {
				// Calculate available height for conversation area
				// InputBar: border top(1) + content lines + border bottom(1) + hint line(1)
				const inputHeight = 2 + inputContentLines + 1;
				const statusHeight = 1;
				const dividerHeight = 1;
				const conversationHeight = Math.max(1, height - inputHeight - statusHeight - dividerHeight);

				return (
					<>
						<ConversationScroll
							messages={messages}
							availableHeight={conversationHeight}
							isStreaming={isStreaming}
						>
							{isStreaming && (
								<StreamingResponse text={streamingText} reasoningText={streamingReasoning} model={model} />
							)}

							<TodoPanel todos={todos} />

							{toolCalls.length > 0 &&
								toolCalls[toolCalls.length - 1].status === "pending" && (
									<ToolPanel
										toolName={toolCalls[toolCalls.length - 1].toolName}
										status={toolCalls[toolCalls.length - 1].status}
										input={
											typeof toolCalls[toolCalls.length - 1].args === "string"
												? (toolCalls[toolCalls.length - 1].args as string)
												: JSON.stringify(toolCalls[toolCalls.length - 1].args, null, 2)
										}
										isFocused={!isStreaming && !pendingApproval && !pendingPreflight}
									/>
								)}

							{pendingApproval && (
								pendingApproval.toolName === "skill_register" ? (
									<SkillApprovalPrompt
										toolName={pendingApproval.toolName}
										toolCallId={pendingApproval.toolCallId}
										args={pendingApproval.args}
										onResponse={handleToolApproval}
									/>
								) : (
									<ToolApprovalPrompt
										toolName={pendingApproval.toolName}
										toolCallId={pendingApproval.toolCallId}
										args={pendingApproval.args}
										onResponse={handleToolApproval}
									/>
								)
							)}

							{pendingPreflight && (
								<PreflightChecklist
									checklist={pendingPreflight}
									onResponse={handlePreflightApproval}
								/>
							)}
						</ConversationScroll>

						<Divider />

						<InputBar
							onSubmit={handleSubmit}
							isActive={isInputActive}
							screenWidth={width}
							onHeightChange={setInputContentLines}
						/>

						<StatusBar
							connected={connected}
							model={model}
							usage={usage}
						/>
					</>
				);
			}}
		</FullScreenWrapper>
	);
}
