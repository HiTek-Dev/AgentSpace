import { z } from "zod";

export const SecurityModeSchema = z.enum(["full-control", "limited-control"]);

export const ApiEndpointConfigSchema = z.object({
	port: z.number().default(3271),
	host: z.literal("127.0.0.1").default("127.0.0.1"),
});

export const AppConfigSchema = z.object({
	securityMode: SecurityModeSchema,
	workspaceDir: z.string().optional(),
	apiEndpoint: ApiEndpointConfigSchema.default(() => ({ port: 3271, host: "127.0.0.1" as const })),
	onboardingComplete: z.boolean().default(false),
	createdAt: z.string().datetime(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
