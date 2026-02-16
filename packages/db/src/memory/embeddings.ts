import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { getDb } from "../connection.js";
import { memories } from "../schema/index.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

/**
 * Generate a single embedding vector for the given text.
 */
export async function generateEmbedding(
	text: string,
): Promise<{ embedding: number[]; tokens: number }> {
	const { embedding, usage } = await embed({
		model: openai.embedding(EMBEDDING_MODEL),
		value: text,
	});
	return { embedding, tokens: usage.tokens };
}

/**
 * Generate embeddings for multiple texts in a single batch call (more efficient).
 */
export async function generateEmbeddings(
	texts: string[],
): Promise<{ embeddings: number[][]; tokens: number }> {
	const { embeddings, usage } = await embedMany({
		model: openai.embedding(EMBEDDING_MODEL),
		values: texts,
	});
	return { embeddings, tokens: usage.tokens };
}

/**
 * Store a pre-computed embedding in vec_memories linked to a memory record.
 * Converts Float32Array to Uint8Array blob for sqlite-vec storage.
 */
export function storeEmbedding(memoryId: number, embedding: number[]): void {
	const db = getDb();
	const blob = new Uint8Array(new Float32Array(embedding).buffer);
	// Use raw SQL for vec0 virtual table (Drizzle doesn't support sqlite-vec virtual tables)
	const sqlite = (db as any).$client;
	sqlite
		.prepare("INSERT INTO vec_memories (memory_id, content_embedding) VALUES (?, ?)")
		.run(memoryId, blob);
}

/**
 * Combined operation: embed text, insert memory record, store vector.
 * Returns the new memory ID and token usage.
 */
export async function embedAndStore(
	content: string,
	opts: {
		threadId?: string;
		memoryType: "fact" | "preference" | "decision" | "summary";
		source?: string;
	},
): Promise<{ memoryId: number; tokens: number }> {
	const { embedding, tokens } = await generateEmbedding(content);
	const db = getDb();

	// Insert memory metadata
	const result = db
		.insert(memories)
		.values({
			threadId: opts.threadId ?? null,
			content,
			memoryType: opts.memoryType,
			source: opts.source ?? "conversation",
			createdAt: new Date().toISOString(),
		})
		.returning({ id: memories.id })
		.get();

	// Store vector embedding
	storeEmbedding(result.id, embedding);

	return { memoryId: result.id, tokens };
}

export { EMBEDDING_DIMS };
