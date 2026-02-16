import { Entry } from "@napi-rs/keyring";

const SERVICE_NAME = "agentspace";

/**
 * Store a password in the OS keychain under the agentspace service.
 */
export function keychainSet(account: string, password: string): void {
	const entry = new Entry(SERVICE_NAME, account);
	entry.setPassword(password);
}

/**
 * Retrieve a password from the OS keychain.
 * Returns null if the entry does not exist.
 */
export function keychainGet(account: string): string | null {
	try {
		const entry = new Entry(SERVICE_NAME, account);
		return entry.getPassword();
	} catch {
		return null;
	}
}

/**
 * Delete a password from the OS keychain.
 * Returns true if deleted, false if the entry was not found.
 */
export function keychainDelete(account: string): boolean {
	try {
		const entry = new Entry(SERVICE_NAME, account);
		entry.deletePassword();
		return true;
	} catch {
		return false;
	}
}
