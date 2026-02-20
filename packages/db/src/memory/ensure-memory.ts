import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_DIR, CONFIG_DIR_NAME } from "@tek/core";
import { resolveAgentDir } from "./agent-resolver.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Path to the bundled template memory-files directory */
const TEMPLATE_DIR = resolve(__dirname, "../../memory-files");

/**
 * Ensure a memory file exists at the CONFIG_DIR location.
 *
 * Handles two scenarios:
 * 1. First install: copies template from packages/db/memory-files/ to CONFIG_DIR/memory/
 * 2. Dev-mode migration: copies from old __dirname-relative location to CONFIG_DIR/memory/
 *
 * When agentId is provided, files are placed in the agent-specific directory
 * instead of the global memory directory.
 *
 * @param subpath - Path relative to the memory directory (e.g. "SOUL.md", "MEMORY.md", "daily/")
 * @param templateFilename - Filename in the template directory (e.g. "SOUL.md", "MEMORY.md"), or null for directories
 * @param agentId - Optional agent ID for per-agent file placement
 * @returns The absolute path at the CONFIG_DIR location
 */
export function ensureMemoryFile(subpath: string, templateFilename: string | null, agentId?: string): string {
	const baseDir = agentId ? resolveAgentDir(agentId) : join(CONFIG_DIR, "memory");
	const targetPath = join(baseDir, subpath);
	const targetDir = dirname(targetPath);

	// Ensure the directory tree exists
	mkdirSync(targetDir, { recursive: true });

	if (templateFilename === null) {
		// Directory-only ensure (e.g. daily/)
		mkdirSync(targetPath, { recursive: true });
		return targetPath;
	}

	if (existsSync(targetPath)) {
		return targetPath;
	}

	// Check old location (dev-mode migration)
	const oldPath = resolve(TEMPLATE_DIR, templateFilename);
	if (existsSync(oldPath)) {
		copyFileSync(oldPath, targetPath);
		if (!agentId) {
			console.error(`[tek] Migrated ${templateFilename} to ~/.config/${CONFIG_DIR_NAME}/memory/`);
		}
		return targetPath;
	}

	// No template available (deployed install without templates) -- return path anyway
	// Callers handle missing files gracefully (return empty string)
	return targetPath;
}

/**
 * Apply a personality preset by copying the preset template to SOUL.md.
 * Overwrites any existing SOUL.md with the preset content.
 *
 * When agentId is provided, writes to the agent-specific directory.
 *
 * @param presetName - Name of the preset (e.g. "professional", "friendly", "technical", "opinionated")
 * @param agentId - Optional agent ID for per-agent preset application
 * @returns true if the preset was applied, false if the preset file was not found
 */
export function applyPersonalityPreset(presetName: string, agentId?: string): boolean {
	const presetPath = join(TEMPLATE_DIR, "presets", `${presetName}.md`);
	if (!existsSync(presetPath)) return false;
	const baseDir = agentId ? resolveAgentDir(agentId) : join(CONFIG_DIR, "memory");
	const soulPath = join(baseDir, "SOUL.md");
	mkdirSync(dirname(soulPath), { recursive: true });
	copyFileSync(presetPath, soulPath);
	return true;
}

/**
 * Ensure the daily log directory exists at CONFIG_DIR/memory/daily/.
 * @returns The absolute path to the daily directory
 */
export function ensureDailyDir(): string {
	const dailyDir = join(CONFIG_DIR, "memory", "daily");
	mkdirSync(dailyDir, { recursive: true });
	return dailyDir;
}
