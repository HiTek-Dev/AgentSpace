import { nanoid, customAlphabet } from "nanoid";
import { getDb, telegramUsers, pairingCodes } from "@tek/db";
import { eq, and, lt, or } from "drizzle-orm";

/**
 * Custom alphabet: 0-9 + uppercase letters excluding I and O (avoid ambiguity).
 */
const generateCode = customAlphabet("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

/**
 * Generate a 6-character pairing code for a Telegram user.
 * Inserts a row into the pairing_codes table with 1-hour expiry.
 */
export function generatePairingCode(
	telegramChatId: number,
	telegramUserId: number | null,
	telegramUsername: string | null,
): string {
	const db = getDb();
	const code = generateCode();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

	db.insert(pairingCodes)
		.values({
			code,
			telegramChatId,
			telegramUserId,
			telegramUsername,
			createdAt: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
			used: false,
		})
		.run();

	return code;
}

/**
 * Verify a pairing code and link the Telegram user to Tek.
 * Returns the userId, chatId and username if valid, null otherwise.
 * Marks the code as used and creates/updates the telegram_users record.
 */
export function verifyPairingCode(
	code: string,
): { userId: number; chatId: number; username: string | null } | null {
	const db = getDb();
	const now = new Date().toISOString();

	const record = db
		.select()
		.from(pairingCodes)
		.where(eq(pairingCodes.code, code))
		.get();

	if (!record) return null;
	if (record.used) return null;
	if (record.expiresAt < now) return null;
	if (!record.telegramUserId) return null; // User ID required

	// Mark code as used
	db.update(pairingCodes)
		.set({ used: true })
		.where(eq(pairingCodes.code, code))
		.run();

	// Check if telegram_users row already exists for this chatId (re-pairing)
	const existingUser = db
		.select()
		.from(telegramUsers)
		.where(eq(telegramUsers.telegramChatId, record.telegramChatId))
		.get();

	if (existingUser) {
		// Update existing user
		db.update(telegramUsers)
			.set({
				pairedAt: new Date().toISOString(),
				active: true,
				telegramUserId: record.telegramUserId,
				telegramUsername: record.telegramUsername,
			})
			.where(eq(telegramUsers.id, existingUser.id))
			.run();
	} else {
		// Insert new user
		db.insert(telegramUsers)
			.values({
				id: nanoid(),
				telegramChatId: record.telegramChatId,
				telegramUserId: record.telegramUserId,
				telegramUsername: record.telegramUsername,
				pairedAt: new Date().toISOString(),
				active: true,
			})
			.run();
	}

	return {
		userId: record.telegramUserId,
		chatId: record.telegramChatId,
		username: record.telegramUsername,
	};
}

/**
 * Look up a paired and active Telegram user by chatId.
 */
export function getPairedUser(
	telegramChatId: number,
): { id: string; active: boolean } | null {
	const db = getDb();

	const user = db
		.select()
		.from(telegramUsers)
		.where(
			and(
				eq(telegramUsers.telegramChatId, telegramChatId),
				eq(telegramUsers.active, true),
			),
		)
		.get();

	if (!user) return null;
	return { id: user.id, active: user.active };
}

/**
 * Clean up expired or used pairing codes.
 * Deletes codes that are expired OR used and older than 24 hours.
 */
export function cleanExpiredCodes(): void {
	const db = getDb();
	const now = new Date().toISOString();
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

	db.delete(pairingCodes)
		.where(
			or(
				lt(pairingCodes.expiresAt, now),
				and(eq(pairingCodes.used, true), lt(pairingCodes.createdAt, oneDayAgo)),
			),
		)
		.run();
}

/**
 * Approve a Telegram user by user ID to send messages.
 * Returns true if approved successfully, false if user not found or already approved.
 */
export function approveTelegramUser(userId: number): boolean {
	const db = getDb();

	const user = db
		.select()
		.from(telegramUsers)
		.where(eq(telegramUsers.telegramUserId, userId))
		.get();

	if (!user) return false;
	if (user.approved) return false; // Already approved

	db.update(telegramUsers)
		.set({ approved: true })
		.where(eq(telegramUsers.id, user.id))
		.run();

	return true;
}

/**
 * Disapprove a Telegram user by user ID from sending messages.
 * Returns true if disapproved successfully, false if user not found or already disapproved.
 */
export function disapproveTelegramUser(userId: number): boolean {
	const db = getDb();

	const user = db
		.select()
		.from(telegramUsers)
		.where(eq(telegramUsers.telegramUserId, userId))
		.get();

	if (!user) return false;
	if (!user.approved) return false; // Already disapproved

	db.update(telegramUsers)
		.set({ approved: false })
		.where(eq(telegramUsers.id, user.id))
		.run();

	return true;
}

/**
 * Check if a Telegram user is approved by user ID.
 */
export function isTelegramUserApproved(userId: number): boolean {
	const db = getDb();

	const user = db
		.select()
		.from(telegramUsers)
		.where(
			and(
				eq(telegramUsers.telegramUserId, userId),
				eq(telegramUsers.active, true),
			),
		)
		.get();

	return user ? user.approved : false;
}
