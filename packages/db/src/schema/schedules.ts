import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { workflows } from "./workflows.js";

export const schedules = sqliteTable("schedules", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	cronExpression: text("cron_expression").notNull(),
	timezone: text("timezone"),
	activeHoursStart: text("active_hours_start"),
	activeHoursEnd: text("active_hours_end"),
	activeHoursDays: text("active_hours_days"), // JSON array string
	maxRuns: integer("max_runs"),
	workflowId: text("workflow_id").references(() => workflows.id),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	lastRunAt: text("last_run_at"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
