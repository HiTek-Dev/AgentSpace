import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { CONFIG_DIR } from "./types.js";

/**
 * Path to the file that records where tek was installed.
 * Written by install.sh at install time.
 */
export const INSTALL_PATH_FILE = join(CONFIG_DIR, "install-path");

/**
 * Resolve the tek install directory using a 3-tier strategy:
 *
 * 1. Read ~/.config/tek/install-path (written at install time) — primary
 * 2. Fallback: resolve process.argv[1] symlink, but skip if .git/ exists (dev repo)
 * 3. Default: ~/tek
 */
export function getInstallDir(): string {
	// Tier 1: recorded install path
	try {
		if (existsSync(INSTALL_PATH_FILE)) {
			const recorded = readFileSync(INSTALL_PATH_FILE, "utf-8").trim();
			if (recorded && existsSync(recorded)) {
				return recorded;
			}
		}
	} catch {
		// Fall through to tier 2
	}

	// Tier 2: resolve symlink from binary, but skip if it's a git repo
	try {
		const realBin = realpathSync(process.argv[1]);
		// realBin is e.g. <installDir>/packages/cli/dist/index.js
		const candidate = resolve(dirname(realBin), "..", "..", "..");
		if (!existsSync(join(candidate, ".git"))) {
			return candidate;
		}
	} catch {
		// Fall through to tier 3
	}

	// Tier 3: default
	return resolve(homedir(), "tek");
}

/**
 * Validate that a directory is safe to delete as an uninstall target.
 * Returns an error message string if unsafe, or null if safe to proceed.
 */
export function validateUninstallTarget(dir: string): string | null {
	// Never delete a git repository
	if (existsSync(join(dir, ".git"))) {
		return `Refusing to delete "${dir}" — it contains a .git directory (this is a source repository, not an installation)`;
	}

	// Never delete the home directory
	const home = homedir();
	if (dir === home || dir === home + "/") {
		return `Refusing to delete "${dir}" — this is your home directory`;
	}

	// Never delete root
	if (dir === "/") {
		return `Refusing to delete "/" — this is the root filesystem`;
	}

	// Must contain .version file (proof it's a tek installation)
	if (!existsSync(join(dir, ".version"))) {
		return `Refusing to delete "${dir}" — no .version file found (not a tek installation)`;
	}

	return null;
}
