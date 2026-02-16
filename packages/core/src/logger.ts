type LogLevel = "info" | "warn" | "error";

interface Logger {
	info(message: string, data?: Record<string, unknown>): void;
	warn(message: string, data?: Record<string, unknown>): void;
	error(message: string, data?: Record<string, unknown>): void;
}

function formatLog(level: LogLevel, name: string, message: string, data?: Record<string, unknown>): string {
	const timestamp = new Date().toISOString();
	const base = `${timestamp} [${level.toUpperCase()}] [${name}] ${message}`;
	if (data && Object.keys(data).length > 0) {
		return `${base} ${JSON.stringify(data)}`;
	}
	return base;
}

/**
 * Create a simple structured logger that writes to stderr.
 */
export function createLogger(name: string): Logger {
	return {
		info(message: string, data?: Record<string, unknown>): void {
			process.stderr.write(`${formatLog("info", name, message, data)}\n`);
		},
		warn(message: string, data?: Record<string, unknown>): void {
			process.stderr.write(`${formatLog("warn", name, message, data)}\n`);
		},
		error(message: string, data?: Record<string, unknown>): void {
			process.stderr.write(`${formatLog("error", name, message, data)}\n`);
		},
	};
}
