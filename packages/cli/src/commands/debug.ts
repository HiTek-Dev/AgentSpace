import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { CONFIG_DIR, CONFIG_PATH, RUNTIME_PATH, LOG_PATH } from "@tek/core";
import { discoverGateway } from "../lib/discovery.js";

const MEMORY_DIR = join(CONFIG_DIR, "memory");
const DAILY_DIR = join(MEMORY_DIR, "daily");

function safeReadJSON(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return null;
	}
}

function safeRead(path: string, maxBytes = 50_000): string {
	try {
		const content = readFileSync(path, "utf-8");
		if (content.length > maxBytes) {
			return content.slice(-maxBytes) + `\n... (truncated, showing last ${maxBytes} bytes)`;
		}
		return content;
	} catch {
		return "(not found)";
	}
}

function tailLines(path: string, n: number): string {
	try {
		const content = readFileSync(path, "utf-8");
		const lines = content.split("\n");
		return lines.slice(-n).join("\n");
	} catch {
		return "(not found)";
	}
}

function listDir(dir: string): string[] {
	try {
		return readdirSync(dir);
	} catch {
		return [];
	}
}

function fileSize(path: string): string {
	try {
		const s = statSync(path);
		if (s.size < 1024) return `${s.size}B`;
		if (s.size < 1024 * 1024) return `${(s.size / 1024).toFixed(1)}KB`;
		return `${(s.size / (1024 * 1024)).toFixed(1)}MB`;
	} catch {
		return "?";
	}
}

export const debugCommand = new Command("debug")
	.description("Dump diagnostic info for debugging (config, logs, errors, workspace)")
	.option("-o, --output <path>", "Write dump to file instead of stdout")
	.option("--logs <n>", "Number of gateway log lines to include", "100")
	.action(async (opts) => {
		const lines: string[] = [];
		const add = (s: string) => lines.push(s);
		const hr = () => add("─".repeat(60));

		add(`TEK DEBUG DUMP — ${new Date().toISOString()}`);
		add(`Platform: ${process.platform} ${process.arch}`);
		add(`Node: ${process.version}`);
		add(`Home: ${homedir()}`);
		add(`Config dir: ${CONFIG_DIR}`);
		hr();

		// 1. Config (redact API keys)
		add("\n## CONFIG");
		const config = safeReadJSON(CONFIG_PATH);
		if (config && typeof config === "object") {
			const safe = { ...config as Record<string, unknown> };
			// Don't dump API keys
			delete safe.keys;
			add(JSON.stringify(safe, null, 2));
		} else {
			add("(no config found at " + CONFIG_PATH + ")");
		}
		hr();

		// 2. Runtime state
		add("\n## RUNTIME");
		const runtime = safeReadJSON(RUNTIME_PATH);
		if (runtime) {
			add(JSON.stringify(runtime, null, 2));
		} else {
			add("(no runtime.json — gateway not running?)");
		}

		// 3. Gateway discovery
		const gw = discoverGateway();
		add(`\nGateway discovery: ${gw ? `running at port ${gw.port} (pid ${gw.pid})` : "not found"}`);
		hr();

		// 4. Workspace directory check
		add("\n## WORKSPACE");
		const cfg = config as Record<string, unknown> | null;
		const workspaceDir = cfg?.workspaceDir as string | undefined;
		const securityMode = (cfg?.securityMode as string) ?? "limited-control";
		add(`Security mode: ${securityMode}`);
		add(`Workspace dir: ${workspaceDir ?? "(NOT SET)"}`);

		if (workspaceDir) {
			if (existsSync(workspaceDir)) {
				add(`Workspace exists: YES`);
				const contents = listDir(workspaceDir);
				add(`Workspace contents (${contents.length} items): ${contents.slice(0, 20).join(", ")}`);
				try {
					// Test write
					const testPath = join(workspaceDir, ".tek-write-test");
					const { writeFileSync, unlinkSync } = await import("node:fs");
					writeFileSync(testPath, "test", "utf-8");
					unlinkSync(testPath);
					add(`Workspace writable: YES`);
				} catch (e) {
					add(`Workspace writable: NO — ${e instanceof Error ? e.message : String(e)}`);
				}
			} else {
				add(`Workspace exists: NO (directory does not exist!)`);
				add(`>>> This is likely why tool writes fail — workspace dir is configured but doesn't exist on disk.`);
			}
		} else {
			if (securityMode === "limited-control") {
				add(`>>> PROBLEM: securityMode is "limited-control" but workspaceDir is not set.`);
				add(`>>> All file write/read/delete tools will throw: "Workspace directory must be configured in limited-control mode"`);
				add(`>>> FIX: Run "tek config set workspaceDir /path/to/workspace" or set securityMode to "full-control"`);
			}
		}
		hr();

		// 5. Memory directory
		add("\n## MEMORY");
		add(`Memory dir: ${MEMORY_DIR}`);
		add(`Exists: ${existsSync(MEMORY_DIR) ? "YES" : "NO"}`);
		if (existsSync(MEMORY_DIR)) {
			const memContents = listDir(MEMORY_DIR);
			add(`Contents: ${memContents.join(", ")}`);
		}
		if (existsSync(DAILY_DIR)) {
			const dailyFiles = listDir(DAILY_DIR).sort().reverse().slice(0, 5);
			add(`Recent daily logs: ${dailyFiles.join(", ") || "(none)"}`);
		}
		hr();

		// 6. Gateway logs (last N lines)
		const logCount = parseInt(opts.logs, 10) || 100;
		add(`\n## GATEWAY LOG (last ${logCount} lines)`);
		add(`Log path: ${LOG_PATH} (${existsSync(LOG_PATH) ? fileSize(LOG_PATH) : "missing"})`);
		add(tailLines(LOG_PATH, logCount));
		hr();

		// 7. Database check
		add("\n## DATABASE");
		const dbPath = join(CONFIG_DIR, "tek.db");
		add(`DB path: ${dbPath}`);
		add(`Exists: ${existsSync(dbPath) ? `YES (${fileSize(dbPath)})` : "NO"}`);
		hr();

		// 8. Config directory listing
		add("\n## CONFIG DIRECTORY LISTING");
		const configItems = listDir(CONFIG_DIR);
		for (const item of configItems) {
			const fullPath = join(CONFIG_DIR, item);
			try {
				const s = statSync(fullPath);
				add(`  ${s.isDirectory() ? "d" : "f"} ${item.padEnd(30)} ${fileSize(fullPath)}`);
			} catch {
				add(`  ? ${item}`);
			}
		}

		// Output
		const output = lines.join("\n");

		if (opts.output) {
			await writeFile(opts.output, output, "utf-8");
			console.log(chalk.green(`Debug dump written to ${opts.output}`));
		} else {
			console.log(output);
		}
	});
