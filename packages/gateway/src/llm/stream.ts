import { streamText, type ModelMessage } from "ai";
import { getAnthropicProvider } from "./provider.js";
import type { StreamChunk } from "./types.js";

/**
 * Stream a chat response from an Anthropic model using AI SDK 6.
 * Yields text deltas as they arrive, then a final 'done' chunk with usage info.
 */
export async function* streamChatResponse(
	model: string,
	messages: ModelMessage[],
	system?: string,
): AsyncGenerator<StreamChunk> {
	const provider = getAnthropicProvider();

	const result = streamText({
		model: provider(model),
		messages,
		system,
	});

	for await (const chunk of result.textStream) {
		yield { type: "delta", text: chunk };
	}

	const usage = await result.usage;
	const inputTokens = usage.inputTokens ?? 0;
	const outputTokens = usage.outputTokens ?? 0;
	const totalTokens =
		usage.totalTokens ?? inputTokens + outputTokens;

	yield {
		type: "done",
		usage: { inputTokens, outputTokens, totalTokens },
	};
}
