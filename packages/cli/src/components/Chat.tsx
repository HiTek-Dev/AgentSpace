import React, { useCallback } from "react";
import { Box } from "ink";
import { useApp } from "ink";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useChat } from "../hooks/useChat.js";
import { useSlashCommands } from "../hooks/useSlashCommands.js";
import { createChatSendMessage } from "../lib/gateway-client.js";
import { MessageList } from "./MessageList.js";
import { StreamingResponse } from "./StreamingResponse.js";
import { InputBar } from "./InputBar.js";
import { StatusBar } from "./StatusBar.js";

interface ChatProps {
	wsUrl: string;
	initialModel?: string;
	resumeSessionId?: string;
}

/**
 * Full chat interface component. Wires together StatusBar, MessageList,
 * StreamingResponse, InputBar, and slash command dispatch.
 */
export function Chat({ wsUrl, initialModel, resumeSessionId }: ChatProps) {
	const { exit } = useApp();

	const {
		messages,
		streamingText,
		isStreaming,
		sessionId,
		model,
		connected,
		usage,
		handleServerMessage,
		addUserMessage,
		addMessage,
		clearMessages,
		setConnected,
		setModel,
		setSessionId,
	} = useChat({ initialModel, resumeSessionId });

	const { send } = useWebSocket({
		url: wsUrl,
		onMessage: handleServerMessage,
		onClose: useCallback(() => setConnected(false), [setConnected]),
	});

	const { processInput } = useSlashCommands();

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
				}),
			);
		},
		[
			processInput,
			sessionId,
			model,
			addMessage,
			addUserMessage,
			send,
			exit,
			clearMessages,
			setModel,
			setSessionId,
		],
	);

	return (
		<Box flexDirection="column" padding={1}>
			<StatusBar
				connected={connected}
				sessionId={sessionId}
				model={model}
				usage={usage}
			/>

			<MessageList messages={messages} />

			{isStreaming && (
				<StreamingResponse text={streamingText} model={model} />
			)}

			<InputBar onSubmit={handleSubmit} isStreaming={isStreaming} />
		</Box>
	);
}
