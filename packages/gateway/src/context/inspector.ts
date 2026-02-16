import { estimateTokenCount } from "tokenx";
import type { MessageRow } from "../session/types.js";
import { getModelPricing } from "../usage/pricing.js";
import type { ContextSection } from "./types.js";

const SYSTEM_PROMPT = "You are a helpful AI assistant.";

/**
 * Measure a single context section.
 */
function measureSection(
	name: string,
	content: string,
	inputPerMTok: number,
): ContextSection {
	const byteCount = Buffer.byteLength(content, "utf8");
	const tokenEstimate = content.length > 0 ? estimateTokenCount(content) : 0;
	const costEstimate = (tokenEstimate / 1_000_000) * inputPerMTok;
	return { name, content, byteCount, tokenEstimate, costEstimate };
}

/**
 * Inspect context WITHOUT a current user message.
 * Returns section-by-section breakdown of what would be sent in the next request.
 */
export function inspectContext(
	sessionMessages: MessageRow[],
	model: string,
): {
	sections: ContextSection[];
	totals: { byteCount: number; tokenEstimate: number; costEstimate: number };
} {
	const pricing = getModelPricing(model);
	const sections: ContextSection[] = [];

	// System prompt
	sections.push(
		measureSection("system_prompt", SYSTEM_PROMPT, pricing.inputPerMTok),
	);

	// History
	const historyText = sessionMessages
		.map((m) => `${m.role}: ${m.content}`)
		.join("\n");
	sections.push(
		measureSection("history", historyText, pricing.inputPerMTok),
	);

	// Memory (stub for Phase 5)
	sections.push(measureSection("memory", "", pricing.inputPerMTok));

	// Skills (stub for Phase 6)
	sections.push(measureSection("skills", "", pricing.inputPerMTok));

	// Tools (stub for Phase 6)
	sections.push(measureSection("tools", "", pricing.inputPerMTok));

	const totals = sections.reduce(
		(acc, s) => ({
			byteCount: acc.byteCount + s.byteCount,
			tokenEstimate: acc.tokenEstimate + s.tokenEstimate,
			costEstimate: acc.costEstimate + s.costEstimate,
		}),
		{ byteCount: 0, tokenEstimate: 0, costEstimate: 0 },
	);

	return { sections, totals };
}
