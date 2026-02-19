import { Bot } from "grammy";
import { createLogger } from "@tek/core";
import { registerCommands } from "./handlers/commands.js";
import { registerCallbackHandlers } from "./handlers/callback.js";
import { handleTelegramMessage } from "./handlers/message.js";
import { cleanExpiredCodes } from "./auth/pairing.js";

const logger = createLogger("telegram-bot");

/**
 * Create a grammY Bot instance with command and message handlers registered.
 */
export function createTelegramBot(token: string): Bot {
	const bot = new Bot(token);

	registerCommands(bot);
	registerCallbackHandlers(bot);

	// Text message handler (after commands)
	bot.on("message:text", (ctx) => {
		handleTelegramMessage(ctx, bot).catch((err) => {
			logger.error(
				`Telegram message handler error: ${err instanceof Error ? err.message : String(err)}`,
			);
		});
	});

	// Catch-all for unhandled callback queries (important per grammY docs)
	bot.on("callback_query:data", async (ctx) => {
		await ctx.answerCallbackQuery();
	});

	return bot;
}

/**
 * Create and start a Telegram bot with long polling.
 * Also sets up periodic cleanup of expired pairing codes.
 */
export async function startTelegramBot(token: string): Promise<Bot> {
	const bot = createTelegramBot(token);

	// Clean expired pairing codes on start
	cleanExpiredCodes();

	// Clean expired codes every hour
	setInterval(() => cleanExpiredCodes(), 60 * 60 * 1000);

	// Suppress Node.js v24 punycode deprecation warning (triggered by grammY's URL handling)
	const originalEmit = process.emit;
	process.emit = function (event: string, ...args: unknown[]) {
		if (
			event === "warning" &&
			typeof args[0] === "object" &&
			args[0] !== null &&
			(args[0] as { name?: string }).name === "DeprecationWarning" &&
			String((args[0] as { message?: string }).message).includes("punycode")
		) {
			return false;
		}
		return originalEmit.apply(process, [event, ...args] as Parameters<typeof originalEmit>);
	};

	// Start long polling with error handling to avoid crashing the parent process
	try {
		bot.start({
			onStart: () => logger.info("Telegram bot started (long polling)"),
		});
	} catch (err) {
		logger.error(
			`Telegram bot failed to start: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	return bot;
}
