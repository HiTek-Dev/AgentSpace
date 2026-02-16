import type { ModelMessage } from "ai";
import { estimateTokenCount } from "tokenx";
import type { MessageRow } from "../session/types.js";
import { getModelPricing } from "../usage/pricing.js";
import type { ContextSection, AssembledContext } from "./types.js";

const SYSTEM_PROMPT = "You are a helpful AI assistant.";

/**
 * Add a measured section to the sections array.
 */
function addSection(
	sections: ContextSection[],
	name: string,
	content: string,
	inputPerMTok: number,
): void {
	const byteCount = Buffer.byteLength(content, "utf8");
	const tokenEstimate = content.length > 0 ? estimateTokenCount(content) : 0;
	const costEstimate = (tokenEstimate / 1_000_000) * inputPerMTok;
	sections.push({ name, content, byteCount, tokenEstimate, costEstimate });
}

/**
 * Assemble context from session messages and user message for an LLM call.
 * Builds measured sections and constructs the ModelMessage[] array for AI SDK.
 */
export function assembleContext(
	sessionMessages: MessageRow[],
	userMessage: string,
	model: string,
): AssembledContext {
	const pricing = getModelPricing(model);
	const sections: ContextSection[] = [];

	// System prompt (static for Phase 2; memory/soul come in Phase 5)
	addSection(sections, "system_prompt", SYSTEM_PROMPT, pricing.inputPerMTok);

	// History: format prior messages
	const historyText = sessionMessages
		.map((m) => `${m.role}: ${m.content}`)
		.join("\n");
	addSection(sections, "history", historyText, pricing.inputPerMTok);

	// Memory (stub for Phase 5)
	addSection(sections, "memory", "", pricing.inputPerMTok);

	// Skills (stub for Phase 6)
	addSection(sections, "skills", "", pricing.inputPerMTok);

	// Tools (stub for Phase 6)
	addSection(sections, "tools", "", pricing.inputPerMTok);

	// Current user message
	addSection(sections, "user_message", userMessage, pricing.inputPerMTok);

	// Build ModelMessage[] for AI SDK from session history + current message
	const messages: ModelMessage[] = [
		...sessionMessages.map(
			(m): ModelMessage => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			}),
		),
		{ role: "user", content: userMessage },
	];

	// Compute totals
	const totals = sections.reduce(
		(acc, s) => ({
			byteCount: acc.byteCount + s.byteCount,
			tokenEstimate: acc.tokenEstimate + s.tokenEstimate,
			costEstimate: acc.costEstimate + s.costEstimate,
		}),
		{ byteCount: 0, tokenEstimate: 0, costEstimate: 0 },
	);

	return { sections, totals, messages, system: SYSTEM_PROMPT };
}
