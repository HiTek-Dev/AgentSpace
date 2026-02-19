import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@tek/core";
import { ensureMemoryFile } from "./ensure-memory.js";

/** Path to the identity document */
const IDENTITY_PATH = join(CONFIG_DIR, "memory", "IDENTITY.md");

/** Path to the style guide document */
const STYLE_PATH = join(CONFIG_DIR, "memory", "STYLE.md");

/** Path to the user context document */
const USER_PATH = join(CONFIG_DIR, "memory", "USER.md");

/** Path to the agents configuration document */
const AGENTS_PATH = join(CONFIG_DIR, "memory", "AGENTS.md");

/**
 * Load the contents of IDENTITY.md.
 * Seeds from template on first run.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadIdentity(): string {
	ensureMemoryFile("IDENTITY.md", "IDENTITY.md");
	if (!existsSync(IDENTITY_PATH)) return "";
	return readFileSync(IDENTITY_PATH, "utf-8");
}

/**
 * Load the contents of STYLE.md.
 * Seeds from template on first run.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadStyle(): string {
	ensureMemoryFile("STYLE.md", "STYLE.md");
	if (!existsSync(STYLE_PATH)) return "";
	return readFileSync(STYLE_PATH, "utf-8");
}

/**
 * Load the contents of USER.md.
 * Seeds from template on first run.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadUser(): string {
	ensureMemoryFile("USER.md", "USER.md");
	if (!existsSync(USER_PATH)) return "";
	return readFileSync(USER_PATH, "utf-8");
}

/**
 * Load the contents of AGENTS.md.
 * Seeds from template on first run.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadAgentsConfig(): string {
	ensureMemoryFile("AGENTS.md", "AGENTS.md");
	if (!existsSync(AGENTS_PATH)) return "";
	return readFileSync(AGENTS_PATH, "utf-8");
}
