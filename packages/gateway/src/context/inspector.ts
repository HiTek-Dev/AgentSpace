import { estimateTokenCount } from "tokenx";
import {
	loadConfig,
	discoverSkills,
	getSkillsDirs,
	formatSkillsForContext,
} from "@tek/core";
import type { MessageRow } from "../session/types.js";
import { getModelPricing } from "../usage/pricing.js";
import type { ContextSection } from "./types.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { ThreadManager } from "../memory/thread-manager.js";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

/** Lazy-init singleton instances (matches assembler.ts pattern) */
let memoryManagerInstance: MemoryManager | null = null;
let threadManagerInstance: ThreadManager | null = null;

function getMemoryManager(): MemoryManager {
	if (!memoryManagerInstance) {
		memoryManagerInstance = new MemoryManager();
	}
	return memoryManagerInstance;
}

function getThreadManager(): ThreadManager {
	if (!threadManagerInstance) {
		threadManagerInstance = new ThreadManager();
	}
	return threadManagerInstance;
}

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
 *
 * Uses real MemoryManager and ThreadManager to mirror assembler output,
 * showing accurate byte/token/cost for all identity and memory sections.
 */
export function inspectContext(
	sessionMessages: MessageRow[],
	model: string,
	agentId?: string,
): {
	sections: ContextSection[];
	totals: { byteCount: number; tokenEstimate: number; costEstimate: number };
} {
	const pricing = getModelPricing(model);
	const sections: ContextSection[] = [];

	// System prompt from ThreadManager (matches assembler.ts)
	const threadManager = getThreadManager();
	const systemPrompt = threadManager.buildSystemPrompt() || DEFAULT_SYSTEM_PROMPT;
	sections.push(measureSection("system_prompt", systemPrompt, pricing.inputPerMTok));

	// Load memory context via MemoryManager (matches assembler.ts)
	const memoryManager = getMemoryManager();
	const memoryCtx = memoryManager.getMemoryContext(agentId);

	// Identity and memory sections (matching assembler.ts section names exactly)
	sections.push(measureSection("soul", memoryCtx.soul, pricing.inputPerMTok));
	sections.push(measureSection("identity", memoryCtx.identity, pricing.inputPerMTok));
	sections.push(measureSection("style", memoryCtx.style, pricing.inputPerMTok));
	sections.push(measureSection("user_context", memoryCtx.user, pricing.inputPerMTok));
	sections.push(measureSection("agents", memoryCtx.agents, pricing.inputPerMTok));
	sections.push(measureSection("long_term_memory", memoryCtx.longTermMemory, pricing.inputPerMTok));
	sections.push(measureSection("recent_activity", memoryCtx.recentLogs, pricing.inputPerMTok));

	// History
	const historyText = sessionMessages
		.map((m) => `${m.role}: ${m.content}`)
		.join("\n");
	sections.push(measureSection("history", historyText, pricing.inputPerMTok));

	// Skills: discover and format from config (same try/catch pattern as assembler)
	let skillsContent = "";
	try {
		const config = loadConfig();
		if (config) {
			const skillsDirs = getSkillsDirs({
				workspaceDir: config.workspaceDir,
				skillsDir: config.skillsDir,
			});
			const skills = discoverSkills(skillsDirs);
			skillsContent = formatSkillsForContext(skills);
		}
	} catch {
		// Skills loading is best-effort; continue with empty skills
	}
	sections.push(measureSection("skills", skillsContent, pricing.inputPerMTok));

	// Tools: tool descriptions aren't available at inspection time
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
