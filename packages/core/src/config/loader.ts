import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { AppConfigSchema, type AppConfig } from "./schema.js";
import { CONFIG_DIR, CONFIG_PATH } from "./types.js";

/**
 * Load the application config from disk.
 * Returns null if the config file does not exist.
 * Throws if the file exists but contains invalid data.
 */
export function loadConfig(): AppConfig | null {
	if (!existsSync(CONFIG_PATH)) {
		return null;
	}

	const raw = readFileSync(CONFIG_PATH, "utf-8");
	const data: unknown = JSON.parse(raw);
	return AppConfigSchema.parse(data);
}

/**
 * Save the application config to disk.
 * Creates the config directory if it does not exist.
 */
export function saveConfig(config: AppConfig): void {
	mkdirSync(CONFIG_DIR, { recursive: true });
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Check if a config file exists on disk.
 */
export function configExists(): boolean {
	return existsSync(CONFIG_PATH);
}
