import { createProviderRegistry } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getKey } from "@agentspace/cli/vault";
import { createLogger } from "@agentspace/core";

const logger = createLogger("llm-registry");

// Extract the provider type from what createProviderRegistry expects
type ProviderRegistry = ReturnType<typeof createProviderRegistry>;
type ProviderMap = Parameters<typeof createProviderRegistry>[0];

let cachedRegistry: ProviderRegistry | null = null;

/**
 * Build a provider registry with the given API keys.
 * If no keys are provided, reads them from the vault.
 *
 * Conditionally registers providers based on available keys.
 * Ollama is always registered (local, no key required).
 */
export function buildRegistry(keys?: {
	anthropic?: string;
	openai?: string;
}): ProviderRegistry {
	const anthropicKey = keys?.anthropic ?? getKey("anthropic") ?? undefined;
	const openaiKey = keys?.openai ?? getKey("openai") ?? undefined;

	const providers: ProviderMap = {};

	if (anthropicKey) {
		logger.info("Registering Anthropic provider");
		providers.anthropic = createAnthropic({ apiKey: anthropicKey });
	}

	if (openaiKey) {
		logger.info("Registering OpenAI provider");
		providers.openai = createOpenAI({ apiKey: openaiKey });
	}

	// Ollama is local and keyless — always register
	logger.info("Registering Ollama provider (localhost:11434)");
	providers.ollama = createOpenAICompatible({
		name: "ollama",
		baseURL: "http://localhost:11434/v1",
	});

	return createProviderRegistry(providers);
}

/**
 * Get the singleton provider registry instance.
 * Lazy-initializes on first call, then caches for subsequent calls.
 */
export function getRegistry(): ProviderRegistry {
	if (!cachedRegistry) {
		cachedRegistry = buildRegistry();
	}
	return cachedRegistry;
}

/**
 * Resolve a model ID to a provider-qualified format.
 *
 * If the model already contains ":" (e.g. "openai:gpt-4o"), return as-is.
 * Otherwise, prefix with "anthropic:" for backward compatibility with
 * bare model names like "claude-sonnet-4-5-20250929".
 */
export function resolveModelId(model: string): string {
	if (model.includes(":")) {
		return model;
	}
	return `anthropic:${model}`;
}

/**
 * Get the list of providers that have valid API keys configured.
 * Ollama is always included (local, no key required).
 */
export function getAvailableProviders(): string[] {
	const available: string[] = [];

	if (getKey("anthropic")) {
		available.push("anthropic");
	}

	if (getKey("openai")) {
		available.push("openai");
	}

	// Ollama is always available (may not be running, but it's registered)
	available.push("ollama");

	return available;
}
