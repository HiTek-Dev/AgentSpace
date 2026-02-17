import * as pty from "node-pty";

export interface PtyProxyOptions {
	command: string;
	args?: string[];
	cwd?: string;
	cols?: number;
	rows?: number;
	env?: Record<string, string>;
}

export interface PtyProxyResult {
	exitCode: number;
}

/**
 * Spawn an interactive PTY subprocess and route stdin/stdout.
 *
 * IMPORTANT: Ink must be unmounted before calling this function.
 * node-pty requires exclusive raw mode access to stdin.
 *
 * Returns a promise that resolves when the subprocess exits.
 */
export async function runPtyProxy(
	opts: PtyProxyOptions,
): Promise<PtyProxyResult> {
	return new Promise((resolve) => {
		const shell = opts.command;
		const args = opts.args ?? [];
		const cols = opts.cols ?? process.stdout.columns ?? 80;
		const rows = opts.rows ?? process.stdout.rows ?? 24;

		const ptyProcess = pty.spawn(shell, args, {
			name: "xterm-256color",
			cols,
			rows,
			cwd: opts.cwd ?? process.cwd(),
			env: opts.env ?? (process.env as Record<string, string>),
		});

		// Forward PTY output to user's terminal
		ptyProcess.onData((data: string) => {
			process.stdout.write(data);
		});

		// Forward user input to PTY
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(true);
		}
		process.stdin.resume();

		const onStdinData = (data: Buffer) => {
			ptyProcess.write(data.toString());
		};
		process.stdin.on("data", onStdinData);

		// Handle terminal resize
		const onResize = () => {
			ptyProcess.resize(
				process.stdout.columns ?? 80,
				process.stdout.rows ?? 24,
			);
		};
		process.stdout.on("resize", onResize);

		// Clean up on PTY exit
		ptyProcess.onExit(({ exitCode }) => {
			process.stdin.removeListener("data", onStdinData);
			process.stdout.removeListener("resize", onResize);
			if (process.stdin.isTTY) {
				process.stdin.setRawMode(false);
			}
			process.stdin.pause();
			resolve({ exitCode: exitCode ?? 0 });
		});
	});
}
