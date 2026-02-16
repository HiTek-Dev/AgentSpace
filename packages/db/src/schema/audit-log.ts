import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const auditLog = sqliteTable("audit_log", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	timestamp: text("timestamp").notNull(),
	event: text("event").notNull(),
	provider: text("provider"),
	sourceIp: text("source_ip"),
	sourceApp: text("source_app"),
	details: text("details"),
});
