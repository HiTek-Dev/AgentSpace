import { streamText, type ModelMessage } from "ai";
import { getRegistry } from "./registry.js";
import type { StreamChunk } from "./types.js";

/**
 * Stream a chat response from any provider via the unified registry.
 * The model parameter must be provider-qualified (e.g. "anthropic:claude-sonnet-4-5-20250929").
 * Yields text deltas as they arrive, then a final 'done' chunk with usage info.
 */
export async function* streamChatResponse(
	model: string,
	messages: ModelMessage[],
	system?: string,
): AsyncGenerator<StreamChunk> {
	const registry = getRegistry();
	// Registry is built dynamically so its type parameter is empty.
	// Cast model string to satisfy the typed overload.
	const languageModel = registry.languageModel(model as never);

	const result = streamText({
		model: languageModel,
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
