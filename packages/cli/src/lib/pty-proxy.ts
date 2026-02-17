import * as pty from "node-pty";

export interface PtyProxyOptions {
	command: string;
	args?: string[];
	cwd?: string;
	cols?: number;
	rows?: number;
	env?: Record<string, string>;
	/** If provided, PTY output snapshots are sent to this callback (ANSI-stripped). */
	onSnapshot?: (content: string) => void;
	/** If provided, agent input is injected from this event source. Returns cleanup function. */
	onAgentInput?: (handler: (data: string) => void) => (() => void);
	/** Called when user revokes agent control via Ctrl+backslash. */
	onControlRevoke?: () => void;
}

export interface PtyProxyResult {
	exitCode: number;
}

/** Strip ANSI escape sequences for clean text snapshots. */
function stripAnsi(str: string): string {
	return str
		.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
		.replace(/\x1b\][^\x07]*\x07/g, ""); // OSC sequences
}

/** Maximum snapshot buffer size in characters. */
const SNAPSHOT_BUFFER_SIZE = 4000;

/** Snapshot emission throttle interval in ms. */
const SNAPSHOT_THROTTLE_MS = 500;

/**
 * Spawn an interactive PTY subprocess and route stdin/stdout.
 *
 * IMPORTANT: Ink must be unmounted before calling this function.
 * node-pty requires exclusive raw mode access to stdin.
 *
 * When agent observation is enabled (onSnapshot provided), PTY output
 * is ANSI-stripped and sent as throttled snapshots. Agent input can be
 * injected via onAgentInput. User can reclaim exclusive control with
 * Ctrl+backslash (\x1c).
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

		// Agent observation: rolling snapshot buffer + throttled emission
		let snapshotBuffer = "";
		let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
		let agentControlActive = !!opts.onSnapshot;

		const emitSnapshot = () => {
			if (opts.onSnapshot && agentControlActive) {
				opts.onSnapshot(snapshotBuffer);
			}
			snapshotTimer = null;
		};

		// Forward PTY output to user's terminal
		ptyProcess.onData((data: string) => {
			process.stdout.write(data);

			// Append stripped output to snapshot buffer if agent observation is enabled
			if (opts.onSnapshot) {
				const stripped = stripAnsi(data);
				snapshotBuffer += stripped;
				// Trim to rolling window
				if (snapshotBuffer.length > SNAPSHOT_BUFFER_SIZE) {
					snapshotBuffer = snapshotBuffer.slice(-SNAPSHOT_BUFFER_SIZE);
				}
				// Throttled emission
				if (!snapshotTimer) {
					snapshotTimer = setTimeout(emitSnapshot, SNAPSHOT_THROTTLE_MS);
				}
			}
		});

		// Agent input injection
		let agentInputCleanup: (() => void) | null = null;
		if (opts.onAgentInput) {
			agentInputCleanup = opts.onAgentInput((data: string) => {
				if (agentControlActive) {
					ptyProcess.write(data);
				}
			});
		}

		// Forward user input to PTY
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(true);
		}
		process.stdin.resume();

		const onStdinData = (data: Buffer) => {
			const str = data.toString();

			// Ctrl+backslash (\x1c) — user reclaims exclusive control
			if (str === "\x1c") {
				if (agentControlActive) {
					agentControlActive = false;
					opts.onControlRevoke?.();
					console.log("\n[proxy] Agent control revoked — you have exclusive control");
				}
				return; // Consume the keystroke, do NOT forward to PTY
			}

			ptyProcess.write(str);
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
			// Clear pending snapshot timer
			if (snapshotTimer) {
				clearTimeout(snapshotTimer);
			}

			// Clean up agent input listener
			if (agentInputCleanup) {
				agentInputCleanup();
			}

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
