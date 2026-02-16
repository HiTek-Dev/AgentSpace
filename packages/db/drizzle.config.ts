import { defineConfig } from "drizzle-kit";
import { join } from "node:path";
import { homedir } from "node:os";

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/schema/index.ts",
	out: "./drizzle",
	dbCredentials: {
		url: join(homedir(), ".config", "agentspace", "agentspace.db"),
	},
});
