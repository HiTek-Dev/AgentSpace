import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workflows = sqliteTable("workflows", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	definitionPath: text("definition_path").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

export const workflowExecutions = sqliteTable("workflow_executions", {
	id: text("id").primaryKey(),
	workflowId: text("workflow_id")
		.notNull()
		.references(() => workflows.id),
	status: text("status").notNull(), // running|paused|completed|failed
	currentStepId: text("current_step_id"),
	stepResults: text("step_results"), // JSON string
	triggeredBy: text("triggered_by").notNull(), // manual|cron|heartbeat
	startedAt: text("started_at").notNull(),
	pausedAt: text("paused_at"),
	completedAt: text("completed_at"),
	error: text("error"),
});
