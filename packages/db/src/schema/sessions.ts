import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	sessionKey: text("session_key").notNull().unique(),
	agentId: text("agent_id").notNull().default("default"),
	model: text("model").notNull(),
	createdAt: text("created_at").notNull(),
	lastActiveAt: text("last_active_at").notNull(),
});
