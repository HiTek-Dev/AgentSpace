/**
 * Model pricing in USD per million tokens.
 * Sources: Anthropic, OpenAI pricing pages. Ollama is local (free).
 *
 * Keys use provider-qualified format ("provider:model-family").
 * Legacy bare Anthropic names are kept for backward compatibility.
 */
export const MODEL_PRICING: Record<
	string,
	{ inputPerMTok: number; outputPerMTok: number }
> = {
	// Anthropic (provider-qualified)
	"anthropic:claude-opus-4.6": { inputPerMTok: 5, outputPerMTok: 25 },
	"anthropic:claude-opus-4.5": { inputPerMTok: 5, outputPerMTok: 25 },
	"anthropic:claude-sonnet-4.5": { inputPerMTok: 3, outputPerMTok: 15 },
	"anthropic:claude-sonnet-4": { inputPerMTok: 3, outputPerMTok: 15 },
	"anthropic:claude-haiku-4.5": { inputPerMTok: 1, outputPerMTok: 5 },
	"anthropic:claude-haiku-3.5": { inputPerMTok: 0.8, outputPerMTok: 4 },

	// Anthropic (bare names for backward compatibility)
	"claude-opus-4.6": { inputPerMTok: 5, outputPerMTok: 25 },
	"claude-opus-4.5": { inputPerMTok: 5, outputPerMTok: 25 },
	"claude-sonnet-4.5": { inputPerMTok: 3, outputPerMTok: 15 },
	"claude-sonnet-4": { inputPerMTok: 3, outputPerMTok: 15 },
	"claude-haiku-4.5": { inputPerMTok: 1, outputPerMTok: 5 },
	"claude-haiku-3.5": { inputPerMTok: 0.8, outputPerMTok: 4 },

	// OpenAI
	"openai:gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10 },
	"openai:gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
	"openai:o3": { inputPerMTok: 2, outputPerMTok: 8 },
	"openai:o3-mini": { inputPerMTok: 1.1, outputPerMTok: 4.4 },
	"openai:o4-mini": { inputPerMTok: 1.1, outputPerMTok: 4.4 },
	"openai:gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
	"openai:gpt-4.1-mini": { inputPerMTok: 0.4, outputPerMTok: 1.6 },
	"openai:gpt-4.1-nano": { inputPerMTok: 0.1, outputPerMTok: 0.4 },
};

/**
 * Get pricing for a model. Lookup order:
 * 1. Exact match
 * 2. Fuzzy match (base model name, ignoring version suffixes)
 * 3. Ollama wildcard (any "ollama:*" model is free)
 * 4. Default to Sonnet pricing
 */
export function getModelPricing(
	model: string,
): { inputPerMTok: number; outputPerMTok: number } {
	// 1. Exact match
	if (MODEL_PRICING[model]) {
		return MODEL_PRICING[model];
	}

	// 2. Fuzzy match by base model name (e.g. "anthropic:claude-sonnet-4-5-20250929" -> "anthropic:claude-sonnet-4.5")
	for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
		const normalized = key.replace(/\./g, "-");
		if (model.startsWith(normalized)) {
			return pricing;
		}
	}

	// 3. Ollama models are free (local compute)
	if (model.startsWith("ollama:")) {
		return { inputPerMTok: 0, outputPerMTok: 0 };
	}

	// 4. Default to Sonnet pricing
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
