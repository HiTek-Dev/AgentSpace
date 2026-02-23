import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const telegramUsers = sqliteTable("telegram_users", {
	id: text("id").primaryKey(),              // nanoid
	telegramChatId: integer("telegram_chat_id").notNull().unique(),
	telegramUserId: integer("telegram_user_id").notNull(),  // Telegram user ID (stable across chats)
	telegramUsername: text("telegram_username"),
	pairedAt: text("paired_at").notNull(),    // ISO timestamp
	active: integer("active", { mode: "boolean" }).notNull().default(true),
	approved: integer("approved", { mode: "boolean" }).notNull().default(false), // Security: requires manual approval
});

export const pairingCodes = sqliteTable("pairing_codes", {
	code: text("code").primaryKey(),           // 6 alphanumeric chars
	telegramChatId: integer("telegram_chat_id").notNull(),
	telegramUserId: integer("telegram_user_id"),           // Telegram user ID (may be null for group chats)
	telegramUsername: text("telegram_username"),
	createdAt: text("created_at").notNull(),   // ISO timestamp
	expiresAt: text("expires_at").notNull(),   // createdAt + 1 hour
	used: integer("used", { mode: "boolean" }).notNull().default(false),
});
