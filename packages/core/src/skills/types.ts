import { z } from "zod";

export type SkillTier = "workspace" | "managed";

export const SkillMetadataSchema = z.object({
	name: z.string(),
	description: z.string(),
	tier: z.enum(["workspace", "managed"]).default("workspace"),
	version: z.string().optional(),
	tools: z.array(z.string()).optional(),
	triggers: z.array(z.string()).optional(),
});

export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

export interface LoadedSkill {
	metadata: SkillMetadata;
	instructions: string;
	path: string;
	tier: SkillTier;
}
