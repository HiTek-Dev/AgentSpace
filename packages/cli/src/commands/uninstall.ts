import { Command } from "commander";
import { createInterface } from "node:readline";
import { existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import { Entry } from "@napi-rs/keyring";
import { KEYCHAIN_SERVICE, CONFIG_DIR, CLI_COMMAND } from "@tek/core";
import { discoverGateway } from "../lib/discovery.js";

function getInstallDir(): string {
	try {
		const realBin = realpathSync(process.argv[1]);
		return resolve(dirname(realBin), "..", "..", "..");
	} catch {
		return resolve(homedir(), "tek");
	}
}

const KEYCHAIN_ACCOUNTS = [
	"api-key:anthropic",
	"api-key:openai",
	"api-key:ollama",
	"api-key:venice",
	"api-key:google",
	"api-key:telegram",
	"api-endpoint-token",
];

export const uninstallCommand = new Command("uninstall")
	.description("Remove Tek completely from this system")
	.action(async () => {
		const installDir = getInstallDir();
		const launchdPlist = join(
			homedir(),
			"Library",
			"LaunchAgents",
			"com.tek.gateway.plist",
		);

		console.log(chalk.red.bold("This will permanently remove:"));
		console.log(`  - Install directory: ${chalk.dim(installDir)}`);
		console.log(`  - Config directory:  ${chalk.dim(CONFIG_DIR)}`);
		console.log(`  - Database:          ${chalk.dim(join(CONFIG_DIR, "tek.db"))}`);
		console.log(
			`  - Memory files:      ${chalk.dim(join(CONFIG_DIR, "memory/"))}`,
		);
		console.log(`  - Keychain entries:  ${chalk.dim("All provider API keys + auth token")}`);
		if (existsSync(launchdPlist)) {
			console.log(`  - Launchd plist:     ${chalk.dim(launchdPlist)}`);
		}
		if (existsSync("/Applications/Tek.app")) {
			console.log(`  - Desktop app:       ${chalk.dim("/Applications/Tek.app")}`);
		}
		console.log();

		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		const answer = await new Promise<string>((resolve) => {
			rl.question(
				chalk.yellow("Type 'UNINSTALL' to confirm: "),
				(ans) => {
					rl.close();
					resolve(ans.trim());
				},
			);
		});

		if (answer !== "UNINSTALL") {
			console.log("Cancelled.");
			return;
		}

		console.log();

		// 1. Stop gateway if running
		const gateway = discoverGateway();
		if (gateway) {
			console.log(`Stopping gateway (PID ${gateway.pid})...`);
			try {
				process.kill(gateway.pid, "SIGTERM");
				const maxWait = 5_000;
				const interval = 250;
				const start = Date.now();
				while (Date.now() - start < maxWait) {
					await new Promise((r) => setTimeout(r, interval));
					try {
						process.kill(gateway.pid, 0);
					} catch {
						break;
					}
				}
			} catch {
				// Process already gone
			}
		}

		// 2. Remove launchd plist if exists
		if (existsSync(launchdPlist)) {
			try {
				rmSync(launchdPlist, { force: true });
				console.log("Removed launchd plist.");
			} catch {
				console.log(
					chalk.yellow("Warning: Could not remove launchd plist."),
				);
			}
		}

		// 3. Delete keychain entries
		for (const account of KEYCHAIN_ACCOUNTS) {
			try {
				const entry = new Entry(KEYCHAIN_SERVICE, account);
				entry.deletePassword();
			} catch {
				// Entry doesn't exist — skip
			}
		}
		console.log("Removed keychain entries.");

		// 4. Remove config directory
		if (existsSync(CONFIG_DIR)) {
			rmSync(CONFIG_DIR, { recursive: true, force: true });
			console.log("Removed config directory.");
		}

		// 5. Remove desktop app
		if (existsSync("/Applications/Tek.app")) {
			rmSync("/Applications/Tek.app", { recursive: true, force: true });
			console.log("Removed desktop app.");
		}

		// 6. Remove install directory
		if (existsSync(installDir)) {
			rmSync(installDir, { recursive: true, force: true });
			console.log("Removed install directory.");
		}

		// 7. Try to remove PATH from .zshrc
		const zshrc = join(homedir(), ".zshrc");
		if (existsSync(zshrc)) {
			try {
				const { readFileSync, writeFileSync } = await import("node:fs");
				const content = readFileSync(zshrc, "utf-8");
				const filtered = content
					.split("\n")
					.filter(
						(line) =>
							!line.includes(`${installDir}/bin`) &&
							line.trim() !== "# Tek AI Agent Gateway",
					)
					.join("\n");
				if (filtered !== content) {
					writeFileSync(zshrc, filtered);
					console.log("Removed PATH entry from ~/.zshrc.");
				}
			} catch {
				console.log(
					"Remove this line from your shell profile (~/.zshrc or ~/.bashrc):",
				);
				console.log(
					chalk.cyan(`  export PATH="${installDir}/bin:$PATH"`),
				);
			}
		}

		console.log();
		console.log(chalk.green("Tek uninstalled completely."));
	});
