import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sessions } from "./sessions.js";

export const usageRecords = sqliteTable("usage_records", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	sessionId: text("session_id")
		.notNull()
		.references(() => sessions.id),
	model: text("model").notNull(),
	inputTokens: integer("input_tokens").notNull(),
	outputTokens: integer("output_tokens").notNull(),
	totalTokens: integer("total_tokens").notNull(),
	cost: real("cost").notNull(),
	timestamp: text("timestamp").notNull(),
});
