import { createAnthropic } from "@ai-sdk/anthropic";
import { getKey } from "@agentspace/cli/vault";
import { createLogger } from "@agentspace/core";

const logger = createLogger("llm-provider");

/**
 * Get an Anthropic provider instance using the API key stored in the vault.
 * Throws a descriptive error if no key is configured.
 */
export function getAnthropicProvider(): ReturnType<typeof createAnthropic> {
	const apiKey = getKey("anthropic");
	if (!apiKey) {
		throw new Error(
			"Anthropic API key not configured. Run: agentspace keys add anthropic",
		);
	}

	logger.info("Creating Anthropic provider with vault API key");
	return createAnthropic({ apiKey });
}
