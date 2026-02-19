import {
	loadSoul,
	loadLongTermMemory,
	loadRecentLogs,
	searchMemories,
	embedAndStore,
	appendDailyLog,
	loadIdentity,
	loadStyle,
	loadUser,
	loadAgentsConfig,
} from "@tek/db";
import type { SearchResult } from "@tek/db";
import { loadConfig } from "@tek/core";

/**
 * Orchestrates all memory operations: context building, semantic search,
 * memory storage, and pressure-triggered daily log flushes.
 */
export class MemoryManager {
	/**
	 * Build memory context for the assembler.
	 * Loads soul personality, all identity files, long-term memory facts, and recent daily logs.
	 * AGENTS.md only loaded when config has multiple agents (saves tokens for single-agent setups).
	 */
	getMemoryContext(agentId?: string): {
		soul: string;
		identity: string;
		style: string;
		user: string;
		agents: string;
		longTermMemory: string;
		recentLogs: string;
	} {
		// Only load AGENTS.md when multiple agents are configured (token efficiency)
		const config = loadConfig();
		const agentsList = config?.agents?.list ?? [];
		const agents = agentsList.length > 1 ? loadAgentsConfig() : "";

		return {
			soul: loadSoul(agentId),
			identity: loadIdentity(agentId),
			style: loadStyle(agentId),
			user: loadUser(),
			agents,
			longTermMemory: loadLongTermMemory(),
			recentLogs: loadRecentLogs(),
		};
	}

	/**
	 * Semantic search over stored memories using vector similarity.
	 */
	async search(
		query: string,
		opts?: { topK?: number; threadId?: string },
	): Promise<SearchResult[]> {
		return searchMemories(query, opts);
	}

	/**
	 * Store a new memory with embedding for future semantic search.
	 */
	async storeMemory(
		content: string,
		opts: {
			threadId?: string;
			memoryType: "fact" | "preference" | "decision" | "summary";
			source?: string;
		},
	): Promise<void> {
		await embedAndStore(content, opts);
	}

	/**
	 * Flush content to today's daily log (used during memory pressure).
	 * Preserves important information before context compaction.
	 */
	async flushToDaily(content: string): Promise<void> {
		appendDailyLog(content);
	}
}
