/**
 * Base error class for all AgentSpace errors.
 */
export class AgentSpaceError extends Error {
	readonly code: string;

	constructor(message: string, code: string) {
		super(message);
		this.name = "AgentSpaceError";
		this.code = code;
	}
}

/**
 * Error related to configuration loading or validation.
 */
export class ConfigError extends AgentSpaceError {
	constructor(message: string) {
		super(message, "CONFIG_ERROR");
		this.name = "ConfigError";
	}
}

/**
 * Error related to the credential vault or keychain operations.
 */
export class VaultError extends AgentSpaceError {
	constructor(message: string) {
		super(message, "VAULT_ERROR");
		this.name = "VaultError";
	}
}

/**
 * Error related to authentication or authorization.
 */
export class AuthError extends AgentSpaceError {
	constructor(message: string) {
		super(message, "AUTH_ERROR");
		this.name = "AuthError";
	}
}
