import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, desc } from "drizzle-orm";
import { CONFIG_DIR, DB_PATH } from "@agentspace/core";
import * as schema from "./schema/index.js";
import { auditLog } from "./schema/index.js";

export interface AuditEvent {
	event: string;
	provider?: string;
	sourceIp?: string;
	sourceApp?: string;
	details?: Record<string, unknown>;
}

let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Get a Drizzle ORM instance backed by SQLite.
 * Creates the database file and enables WAL mode on first call.
 */
export function getDb() {
	if (dbInstance) {
		return dbInstance;
	}

	mkdirSync(CONFIG_DIR, { recursive: true });

	const sqlite = new Database(DB_PATH);
	sqlite.pragma("journal_mode = WAL");

	// Ensure audit_log table exists
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS audit_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			event TEXT NOT NULL,
			provider TEXT,
			source_ip TEXT,
			source_app TEXT,
			details TEXT
		)
	`);

	dbInstance = drizzle(sqlite, { schema });
	return dbInstance;
}

/**
 * Record an audit event in the database.
 */
export function recordAuditEvent(event: AuditEvent): void {
	const db = getDb();
	db.insert(auditLog)
		.values({
			timestamp: new Date().toISOString(),
			event: event.event,
			provider: event.provider ?? null,
			sourceIp: event.sourceIp ?? null,
			sourceApp: event.sourceApp ?? null,
			details: event.details ? JSON.stringify(event.details) : null,
		})
		.run();
}

/**
 * Query audit events from the database.
 */
export function getAuditEvents(opts?: { limit?: number; provider?: string }) {
	const db = getDb();
	const limit = opts?.limit ?? 100;

	if (opts?.provider) {
		return db
			.select()
			.from(auditLog)
			.where(eq(auditLog.provider, opts.provider))
			.orderBy(desc(auditLog.id))
			.limit(limit)
			.all();
	}

	return db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit).all();
}
