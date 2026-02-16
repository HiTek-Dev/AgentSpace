import { randomBytes } from "node:crypto";

/**
 * Generate a cryptographically secure random auth token.
 * Returns a 256-bit (32-byte) hex-encoded string.
 */
export function generateAuthToken(): string {
	return randomBytes(32).toString("hex");
}
