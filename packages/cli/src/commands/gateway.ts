import { Command } from "commander";
import { spawn } from "node:child_process";
import {
	openSync,
	closeSync,
	createReadStream,
	existsSync,
	statSync,
	realpathSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import chalk from "chalk";
import { LOG_PATH } from "@tek/core";
import { discoverGateway } from "../lib/discovery.js";
import { formatLogLine } from "../lib/log-formatter.js";

function getInstallDir(): string {
	try {
		const realBin = realpathSync(process.argv[1]);
		// realBin is e.g. <installDir>/packages/cli/dist/index.js
		return resolve(dirname(realBin), "..", "..", "..");
	} catch {
		return resolve(homedir(), "tek");
	}
}

export const gatewayCommand = new Command("gateway").description(
	"Manage the Tek gateway process",
);

gatewayCommand
	.command("start")
	.description("Start the gateway")
	.option("--foreground", "Run in the foreground instead of background")
	.action(async (options: { foreground?: boolean }) => {
		const existing = discoverGateway();
		if (existing) {
			console.log(
				chalk.yellow(
					`Gateway already running on 127.0.0.1:${existing.port} (PID ${existing.pid})`,
				),
			);
			return;
		}

		const installDir = getInstallDir();
		const entryPoint = resolve(
			installDir,
			"packages",
			"gateway",
			"dist",
			"index.js",
		);

		if (options.foreground) {
			const child = spawn(process.execPath, [entryPoint], {
				stdio: ["ignore", "inherit", "pipe"],
			});
			if (child.stderr) {
				const rl = createInterface({ input: child.stderr });
				rl.on("line", (line) => {
					console.log(formatLogLine(line));
				});
			}
			// Handle Ctrl+C gracefully
			process.on("SIGINT", () => {
				child.kill("SIGTERM");
			});
			child.on("exit", (code) => {
				process.exit(code ?? 1);
			});
			return;
		}

		// Background mode — redirect stdout/stderr to log file
		const logFd = openSync(LOG_PATH, "a");
		const child = spawn(process.execPath, [entryPoint], {
			detached: true,
			stdio: ["ignore", logFd, logFd],
		});
		child.unref();
		closeSync(logFd);

		// Poll for gateway to become available
		const maxWait = 10_000;
		const interval = 250;
		const start = Date.now();

		while (Date.now() - start < maxWait) {
			await new Promise((r) => setTimeout(r, interval));
			const info = discoverGateway();
			if (info) {
				console.log(
					chalk.green(
						`Gateway started on 127.0.0.1:${info.port} (PID ${info.pid})`,
					),
				);
				console.log(chalk.dim(`  Logs: tek gateway logs`));
				return;
			}
		}

		console.log(
			chalk.red(
				"Gateway did not start within 10 seconds. Check logs for errors.",
			),
		);
		process.exit(1);
	});

gatewayCommand
	.command("stop")
	.description("Stop the running gateway")
	.action(async () => {
		const info = discoverGateway();
		if (!info) {
			console.log(chalk.yellow("Gateway is not running."));
			return;
		}

		try {
			process.kill(info.pid, "SIGTERM");
		} catch {
			console.log(chalk.yellow("Gateway is not running."));
			return;
		}

		// Wait up to 5 seconds for process to die
		const maxWait = 5_000;
		const interval = 250;
		const start = Date.now();

		while (Date.now() - start < maxWait) {
			await new Promise((r) => setTimeout(r, interval));
			try {
				process.kill(info.pid, 0);
			} catch {
				// Process is gone
				console.log(chalk.green("Gateway stopped."));
				return;
			}
		}

		console.log(chalk.red("Failed to stop gateway."));
		process.exit(1);
	});

gatewayCommand
	.command("status")
	.description("Check if the gateway is running")
	.action(() => {
		const info = discoverGateway();
		if (info) {
			console.log(
				chalk.green(
					`Gateway is running on 127.0.0.1:${info.port} (PID ${info.pid})`,
				),
			);
		} else {
			console.log(chalk.yellow("Gateway is not running."));
		}
	});

gatewayCommand
	.command("logs")
	.description("Tail gateway logs with colored formatting")
	.option("-n, --lines <count>", "Number of recent lines to show", "20")
	.option("-f, --follow", "Follow log output (default: true)", true)
	.option("--filter <logger>", "Filter by logger name")
	.action(
		async (options: { lines: string; follow: boolean; filter?: string }) => {
			if (!existsSync(LOG_PATH)) {
				console.log(
					chalk.yellow("No log file found. Start the gateway first."),
				);
				return;
			}

			// Read last N lines first
			const content = await import("node:fs/promises").then((fs) =>
				fs.readFile(LOG_PATH, "utf-8"),
			);
			const allLines = content.split("\n").filter(Boolean);
			const lineCount = parseInt(options.lines, 10) || 20;
			const recentLines = allLines.slice(-lineCount);

			for (const line of recentLines) {
				if (options.filter && !line.includes(`[${options.filter}]`))
					continue;
				console.log(formatLogLine(line));
			}

			if (!options.follow) return;

			// Tail the file for new lines
			console.log(chalk.dim("--- following logs (Ctrl+C to stop) ---"));

			const fileSize = statSync(LOG_PATH).size;
			let position = fileSize;

			const tailInterval = setInterval(async () => {
				try {
					const currentSize = statSync(LOG_PATH).size;
					if (currentSize <= position) {
						if (currentSize < position) position = 0; // file truncated
						return;
					}
					const stream = createReadStream(LOG_PATH, {
						start: position,
						encoding: "utf-8",
					});
					let buffer = "";
					for await (const chunk of stream) {
						buffer += chunk;
					}
					position = currentSize;
					const newLines = buffer.split("\n").filter(Boolean);
					for (const line of newLines) {
						if (
							options.filter &&
							!line.includes(`[${options.filter}]`)
						)
							continue;
						console.log(formatLogLine(line));
					}
				} catch {
					// file may have been removed
				}
			}, 500);

			// Clean exit on Ctrl+C
			process.on("SIGINT", () => {
				clearInterval(tailInterval);
				process.exit(0);
			});
		},
	);
