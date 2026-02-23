import { Command } from "commander";
import chalk from "chalk";
import {
	verifyPairingCode,
	approveTelegramUser,
	disapproveTelegramUser,
} from "@tek/telegram";

export const pairCommand = new Command("pair")
	.description("Pair with a messaging platform");

pairCommand
	.command("telegram <code>")
	.description("Pair with Telegram using a pairing code from the bot")
	.action((code: string) => {
		const trimmedCode = code.trim().toUpperCase();

		const result = verifyPairingCode(trimmedCode);

		if (result) {
			console.log(
				chalk.green(
					`✓ Successfully paired with Telegram!`,
				),
			);
			console.log(chalk.dim(`  User ID: ${result.userId}`));
			if (result.username) {
				console.log(chalk.dim(`  Username: @${result.username}`));
			}
			console.log(chalk.yellow("⚠ User is NOT yet approved to send messages."));
			console.log(
				chalk.yellow(
					`Approve them with: tek approve telegram ${result.userId}`,
				),
			);
		} else {
			console.error(chalk.red("✗ Pairing failed. The code may be:"));
			console.error(chalk.red("  - Invalid or mistyped"));
			console.error(chalk.red("  - Expired (codes expire after 1 hour)"));
			console.error(chalk.red("  - Already used"));
			console.error("");
			console.error(
				chalk.yellow(
					"Get a new code by sending /pair to your Telegram bot.",
				),
			);
			process.exit(1);
		}
	});

