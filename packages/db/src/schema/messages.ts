import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sessions } from "./sessions.js";

export const messages = sqliteTable("messages", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	sessionId: text("session_id")
		.notNull()
		.references(() => sessions.id),
	role: text("role").notNull(),
	content: text("content").notNull(),
	createdAt: text("created_at").notNull(),
	tokenCount: integer("token_count"),
});
