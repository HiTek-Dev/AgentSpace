import React from "react";
import { Box } from "ink";
import type { ChatMessage } from "../lib/gateway-client.js";
import { MessageBubble } from "./MessageBubble.js";
import { WelcomeScreen } from "./WelcomeScreen.js";

interface ConversationScrollProps {
	messages: ChatMessage[];
	availableHeight: number;
	isStreaming: boolean;
	children?: React.ReactNode;
}

/**
 * Windowed message rendering area replacing Ink's <Static> component.
 *
 * Renders the most recent messages that fit within the available height,
 * using a heuristic estimate of ~3 lines per message. The overflow="hidden"
 * property clips any content that exceeds the viewport.
 *
 * When messages are empty and not streaming, shows the WelcomeScreen.
 * Children (StreamingResponse, TodoPanel, ToolPanel, approval dialogs)
 * are rendered below the message list within the scroll area.
 *
 * NOTE: Height estimation is approximate. Each message is estimated at 3 lines.
 * This can be refined later with measureElement or more sophisticated heuristics.
 */
export function ConversationScroll({
	messages,
	availableHeight,
	isStreaming,
	children,
}: ConversationScrollProps) {
	const showWelcome = messages.length === 0 && !isStreaming;

	// Estimate how many messages fit in the available height.
	// Heuristic: each message takes ~3 lines on average.
	// Reserve some lines for children (streaming, tools, approvals).
	const estimatedLinesPerMessage = 3;
	const reservedForChildren = children ? 8 : 0;
	const availableForMessages = Math.max(0, availableHeight - reservedForChildren);
	const maxMessages = Math.max(1, Math.floor(availableForMessages / estimatedLinesPerMessage));

	// Only render the tail end of messages (auto-scroll to latest)
	const visibleMessages = messages.slice(-maxMessages);

	return (
		<Box
			flexDirection="column"
			flexGrow={1}
			overflow="hidden"
			height={availableHeight > 0 ? availableHeight : undefined}
		>
			{showWelcome && <WelcomeScreen />}

			{visibleMessages.map((msg) => (
				<MessageBubble key={msg.id} message={msg} />
			))}

			{children}
		</Box>
	);
}
