import { Command } from "commander";
import chalk from "chalk";
import {
	approveTelegramUser,
	disapproveTelegramUser,
} from "@tek/telegram";

export const approveCommand = new Command("approve")
	.description("Manage user approvals for messaging platforms");

approveCommand
	.command("telegram <userId>")
	.description("Approve a Telegram user (by user ID) to send messages")
	.action((userId: string) => {
		const numUserId = parseInt(userId, 10);

		if (isNaN(numUserId)) {
			console.error(chalk.red("✗ Invalid user ID. Must be a number."));
			process.exit(1);
		}

		const success = approveTelegramUser(numUserId);

		if (success) {
			console.log(
				chalk.green(
					`✓ Approved Telegram user ${numUserId} to send messages.`,
				),
			);
		} else {
			console.error(
				chalk.red(
					"✗ Could not approve user. They may not be paired or already approved.",
				),
			);
			process.exit(1);
		}
	});

export const disapproveCommand = new Command("disapprove")
	.description("Manage user disapprovals for messaging platforms");

disapproveCommand
	.command("telegram <userId>")
	.description("Disapprove a Telegram user (by user ID) from sending messages")
	.action((userId: string) => {
		const numUserId = parseInt(userId, 10);

		if (isNaN(numUserId)) {
			console.error(chalk.red("✗ Invalid user ID. Must be a number."));
			process.exit(1);
		}

		const success = disapproveTelegramUser(numUserId);

		if (success) {
			console.log(
				chalk.green(
					`✓ Disapproved Telegram user ${numUserId} from sending messages.`,
				),
			);
		} else {
			console.error(
				chalk.red(
					"✗ Could not disapprove user. They may not be paired or already disapproved.",
				),
			);
			process.exit(1);
		}
	});
