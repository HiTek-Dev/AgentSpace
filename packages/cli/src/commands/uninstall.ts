import { Command } from "commander";
import { createInterface } from "node:readline";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import chalk from "chalk";
import { CONFIG_DIR, getInstallDir, validateUninstallTarget } from "@tek/core";
import { keychainDelete, PROVIDERS } from "@tek/core/vault";
import { discoverGateway } from "../lib/discovery.js";

export const uninstallCommand = new Command("uninstall")
	.description("Remove Tek completely from this system")
	.action(async () => {
		const installDir = getInstallDir();

		// Safety check before doing anything
		const unsafeReason = validateUninstallTarget(installDir);
		if (unsafeReason) {
			console.log(chalk.red.bold("Uninstall blocked:"));
			console.log(chalk.red(`  ${unsafeReason}`));
			console.log();
			console.log(
				chalk.dim(
					"If you installed tek elsewhere, create ~/.config/tek/install-path with the correct path.",
				),
			);
			process.exit(1);
		}

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

		// 3. Delete keychain entries (dynamic from PROVIDERS)
		for (const provider of PROVIDERS) {
			keychainDelete(`api-key:${provider}`);
		}
		keychainDelete("api-endpoint-token");
		console.log("Removed keychain entries.");

		// 4. Remove config directory (includes install-path file)
		if (existsSync(CONFIG_DIR)) {
			rmSync(CONFIG_DIR, { recursive: true, force: true });
			console.log("Removed config directory.");
		}

		// 5. Remove desktop app
		if (existsSync("/Applications/Tek.app")) {
			rmSync("/Applications/Tek.app", { recursive: true, force: true });
			console.log("Removed desktop app.");
		}

		// 6. Remove install directory (last-resort .git guard)
		if (existsSync(installDir)) {
			if (existsSync(join(installDir, ".git"))) {
				console.log(
					chalk.red("ABORT: Install directory contains .git — refusing to delete a repository."),
				);
				process.exit(1);
			}
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
