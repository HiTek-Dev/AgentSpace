/**
 * Model pricing in USD per million tokens.
 * Source: Anthropic pricing page (platform.claude.com)
 */
export const MODEL_PRICING: Record<
	string,
	{ inputPerMTok: number; outputPerMTok: number }
> = {
	"claude-opus-4.6": { inputPerMTok: 5, outputPerMTok: 25 },
	"claude-opus-4.5": { inputPerMTok: 5, outputPerMTok: 25 },
	"claude-sonnet-4.5": { inputPerMTok: 3, outputPerMTok: 15 },
	"claude-sonnet-4": { inputPerMTok: 3, outputPerMTok: 15 },
	"claude-haiku-4.5": { inputPerMTok: 1, outputPerMTok: 5 },
	"claude-haiku-3.5": { inputPerMTok: 0.8, outputPerMTok: 4 },
};

/**
 * Get pricing for a model. Falls back to Sonnet pricing for unknown models.
 */
export function getModelPricing(
	model: string,
): { inputPerMTok: number; outputPerMTok: number } {
	// Try exact match first, then try matching the base model name
	if (MODEL_PRICING[model]) {
		return MODEL_PRICING[model];
	}

	// Try to match by base model name (e.g. claude-sonnet-4-5-20250514 -> claude-sonnet-4.5)
	for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
		const normalized = key.replace(/\./g, "-");
		if (model.startsWith(normalized)) {
			return pricing;
		}
	}

	// Default to Sonnet pricing
	return { inputPerMTok: 3, outputPerMTok: 15 };
}

/**
 * Calculate cost in USD for a given model and token counts.
 */
export function calculateCost(
	model: string,
	inputTokens: number,
	outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
	const pricing = getModelPricing(model);
	const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMTok;
	const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok;
	return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
