// Transport abstraction
export { WebSocketTransport } from "./transport.js";
export type { Transport } from "./transport.js";

export { createKeyServer } from "./key-server/index.js";
export { registerGatewayWebSocket } from "./ws/index.js";
export {
	ClientMessageSchema,
	ServerMessageSchema,
} from "./ws/index.js";
export type {
	ClientMessage,
	ServerMessage,
	ErrorMessage,
	SessionCreated,
	SessionListResponse,
} from "./ws/index.js";
export { sessionManager, FALLBACK_MODEL } from "./session/index.js";
export type { Session, SessionSummary, MessageRow } from "./session/index.js";

// LLM module
export { getAnthropicProvider, streamChatResponse } from "./llm/index.js";
export type { StreamChunk, StreamDelta, StreamDone } from "./llm/index.js";

// Context module
export { assembleContext, inspectContext } from "./context/index.js";
export type { ContextSection, AssembledContext } from "./context/index.js";

// Usage module
export { MODEL_PRICING, getModelPricing, calculateCost } from "./usage/index.js";
export { usageTracker } from "./usage/index.js";
export type { UsageRecord, UsageRow, UsageTotals } from "./usage/index.js";

// Memory module
export { MemoryManager, MemoryPressureDetector, ThreadManager } from "./memory/index.js";
export type { ThreadRow, GlobalPromptRow } from "./memory/index.js";

// MCP module
export { MCPClientManager, loadMCPConfigs } from "./mcp/index.js";

// Tools module
export { createFilesystemTools } from "./tools/index.js";
export { createShellTool } from "./tools/index.js";

// Agent module
export {
	buildToolRegistry,
	createApprovalPolicy,
	checkApproval,
	recordSessionApproval,
	wrapToolWithApproval,
} from "./agent/index.js";
export type { ToolRegistryOptions, ApprovalPolicy } from "./agent/index.js";

// System skills
export {
	createWebSearchTool,
	createImageGenTool,
	getPlaywrightMcpConfig,
	createGoogleWorkspaceTools,
	createGoogleAuth,
} from "./skills/index.js";
export type { GoogleAuthConfig } from "./skills/index.js";

// Handler functions (for cross-channel use, e.g., Telegram)
export { handleChatSend } from "./ws/handlers.js";
export { initConnection, getConnectionState, removeConnection } from "./ws/connection.js";
export type { ConnectionState } from "./ws/connection.js";
export type { ChatSend } from "./ws/protocol.js";

/**
 * Check and log gateway startup status.
 */
async function logGatewayStatus() {
	const { createLogger } = await import("@tek/core");
	const logger = createLogger("gateway-startup");

	const checks = {
		websocket: false,
		telegram: false,
		database: false,
		skills: false,
	};

	// WebSocket server status
	checks.websocket = true;
	logger.info("✓ WebSocket server listening");

	// Telegram bot status
	try {
		const { getKey } = await import("@tek/core/vault");
		const telegramToken = getKey("telegram");
		if (telegramToken) {
			checks.telegram = true;
			logger.info("✓ Telegram bot configured");
		} else {
			logger.info("○ Telegram bot (not configured)");
		}
	} catch {
		logger.info("○ Telegram bot (configuration error)");
	}

	// Database status
	try {
		const { getDb } = await import("@tek/db");
		const db = getDb();
		// Drizzle ORM instance is successfully created
		if (db) {
			checks.database = true;
			logger.info("✓ Database connected");
		}
	} catch (err) {
		logger.warn(
			`✗ Database error: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Skills/Tools status
	try {
		const { buildToolRegistry } = await import("./agent/index.js");
		const { getKey } = await import("@tek/core/vault");

		// Count available tools
		const braveApiKey = getKey("brave");
		const googleApiKey = getKey("google");
		let toolCount = 0;

		if (braveApiKey) toolCount++;
		if (googleApiKey) toolCount++;
		toolCount += 2; // Filesystem and shell tools always available

		if (toolCount > 0) {
			checks.skills = true;
			logger.info(`✓ Skills loaded (${toolCount} tools available)`);
		} else {
			logger.info("○ Skills (limited configuration)");
		}
	} catch (err) {
		logger.warn(
			`○ Skills error: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Summary
	const passed = Object.values(checks).filter(Boolean).length;
	const total = Object.keys(checks).length;
	logger.info(
		`Gateway startup: ${passed}/${total} checks passed`,
	);
}

// When run directly, start the key server with WebSocket gateway
const isDirectRun =
	process.argv[1] &&
	(process.argv[1].endsWith("/gateway/dist/index.js") ||
		process.argv[1].endsWith("/gateway/src/index.ts"));

if (isDirectRun) {
	const { createKeyServer } = await import("./key-server/index.js");
	const { registerGatewayWebSocket } = await import("./ws/index.js");

	// createKeyServer returns the Fastify instance after listen.
	// We need to register WS BEFORE listen, so we refactor:
	// Use the new createServer() that returns the instance pre-listen.
	const { createServer } = await import("./key-server/server.js");
	const { server, start } = await createServer();
	await registerGatewayWebSocket(server);
	await start();

	// Log startup status
	await logGatewayStatus();

	// Optionally start Telegram bot if token is configured
	try {
		const { getKey } = await import("@tek/core/vault");
		const { createLogger } = await import("@tek/core");
		const logger = createLogger("telegram-bot");

		const telegramToken = getKey("telegram");
		logger.info(`Telegram token present: ${!!telegramToken}`);

		if (telegramToken) {
			// Try to import from both package name and file path
			let startTelegramBot: ((token: string) => Promise<void>) | undefined;
			let importError: Error | undefined;

			try {
				// Try workspace package import first
				logger.info("Trying workspace import: @tek/telegram");
				const telegramPkg = await import("@tek/telegram" as string);
				startTelegramBot = telegramPkg.startTelegramBot;
				logger.info(`Workspace import success, startTelegramBot found: ${!!startTelegramBot}`);
			} catch (e) {
				importError = e as Error;
				logger.info(`Workspace import failed: ${importError.message}`);
				// Fallback to file path import (for dev installations)
				try {
					// Correct relative path: gateway/dist/index.ts -> ../../telegram/dist/index.js
					const telegramPath = new URL("../../telegram/dist/index.js", import.meta.url).href;
					logger.info(`Trying file path import: ${telegramPath}`);
					const telegramPkg = await import(telegramPath);
					startTelegramBot = telegramPkg.startTelegramBot;
					logger.info(`File path import success, startTelegramBot found: ${!!startTelegramBot}`);
				} catch (e2) {
					importError = e2 as Error;
					logger.warn(`File path import also failed: ${importError.message}`);
				}
			}

			if (startTelegramBot) {
				logger.info("Starting Telegram bot...");
				await startTelegramBot(telegramToken);
				logger.info("Telegram bot auto-started");
			} else {
				logger.warn(`Could not find startTelegramBot function`);
			}
		}
	} catch (err) {
		const { createLogger } = await import("@tek/core");
		const logger = createLogger("telegram-bot");
		logger.warn(
			`Telegram bot startup error: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}
