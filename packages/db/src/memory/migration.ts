import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { CONFIG_DIR } from "@tek/core";
import { loadSoul } from "./soul-manager.js";

/** Marker file indicating migration to multi-file identity has been completed */
const MARKER_PATH = join(CONFIG_DIR, "memory", ".v2-migrated");

/** Memory directory for identity files */
const MEMORY_DIR = join(CONFIG_DIR, "memory");

/**
 * Migrate from single-file SOUL.md to multi-file identity structure.
 *
 * This migration is CONSERVATIVE:
 * - Only creates STYLE.md from extracted "Communication Style" section
 * - Does NOT touch IDENTITY.md, USER.md, or AGENTS.md (seeded via ensureMemoryFile on next load)
 * - Does NOT modify SOUL.md content structure (preserves user customizations)
 * - Idempotent: marker file prevents re-runs
 * - Creates backup before any modifications
 *
 * @returns Migration result with status and optional backup path
 */
export function migrateToMultiFile(): { migrated: boolean; backup?: string } {
	// 1. Check marker -- idempotent
	if (existsSync(MARKER_PATH)) {
		return { migrated: false };
	}

	// Ensure memory directory exists
	mkdirSync(MEMORY_DIR, { recursive: true });

	// 2. Load existing SOUL.md
	const soulContent = loadSoul();

	// 3. No soul content -- fresh install, templates handle seeding
	if (!soulContent) {
		writeFileSync(MARKER_PATH, new Date().toISOString(), "utf-8");
		return { migrated: false };
	}

	// 4. Create backup
	const timestamp = Date.now();
	const soulPath = join(MEMORY_DIR, "SOUL.md");
	const backupPath = join(MEMORY_DIR, `SOUL.md.backup-${timestamp}`);
	copyFileSync(soulPath, backupPath);

	// 5. Extract "Communication Style" section -> STYLE.md (only if STYLE.md doesn't exist)
	const stylePath = join(MEMORY_DIR, "STYLE.md");
	if (!existsSync(stylePath)) {
		const styleContent = extractSection(soulContent, "Communication Style");
		if (styleContent) {
			writeFileSync(stylePath, `# Communication Style\n\n${styleContent}`, "utf-8");
		}
	}

	// 6. Do NOT overwrite SOUL.md -- preserve user customizations
	// The expanded template only applies to fresh installs via ensureMemoryFile()

	// 7. Write marker with ISO timestamp
	writeFileSync(MARKER_PATH, new Date().toISOString(), "utf-8");

	return { migrated: true, backup: backupPath };
}

/**
 * Extract content under a specific ## header from markdown.
 * Returns the content between the header and the next ## header (or end of file).
 * Returns empty string if section not found.
 */
function extractSection(content: string, sectionName: string): string {
	const headerPattern = new RegExp(`^## ${sectionName}\\s*$`, "m");
	const match = content.match(headerPattern);
	if (!match || match.index === undefined) return "";

	const afterHeader = content.indexOf("\n", match.index);
	if (afterHeader === -1) return "";

	const remaining = content.slice(afterHeader + 1);
	const nextSection = remaining.search(/^## /m);

	const sectionContent = nextSection !== -1
		? remaining.slice(0, nextSection).trim()
		: remaining.trim();

	return sectionContent;
}
