import React, { useState } from "react";
import { Box, Text } from "ink";
import { Select, TextInput } from "@inkjs/ui";
import { buildModelOptions } from "../lib/models.js";

type AgentOnboardingStep =
	| "agent-name"
	| "user-display-name"
	| "personality-preset"
	| "model-override"
	| "workspace-scope"
	| "workspace-dir"
	| "purpose"
	| "summary"
	| "done";

export interface AgentOnboardingResult {
	agentName: string;
	userDisplayName?: string;
	personalityPreset: string;
	modelOverride?: string;
	accessMode: "full" | "limited";
	workspaceDir?: string;
	purpose?: string;
}

export interface AgentOnboardingProps {
	onComplete: (result: AgentOnboardingResult) => void;
	initialName?: string;
	configuredProviders?: string[];
}

export function AgentOnboarding({
	onComplete,
	initialName,
	configuredProviders,
}: AgentOnboardingProps) {
	const [step, setStep] = useState<AgentOnboardingStep>("agent-name");
	const [agentName, setAgentName] = useState(initialName ?? "");
	const [userDisplayName, setUserDisplayName] = useState("");
	const [personalityPreset, setPersonalityPreset] = useState("skip");
	const [modelOverride, setModelOverride] = useState<string | undefined>();
	const [accessMode, setAccessMode] = useState<"full" | "limited">("full");
	const [workspaceDir, setWorkspaceDir] = useState("");
	const [purpose, setPurpose] = useState("");

	/** Build model options from configured providers. */
	function buildAvailableModels(): Array<{ label: string; value: string }> {
		const models: Array<{ label: string; value: string }> = [];
		if (configuredProviders) {
			for (const provider of configuredProviders) {
				models.push(...buildModelOptions(provider));
			}
		}
		return models;
	}

	if (step === "agent-name") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					Create a New Agent
				</Text>
				<Text />
				<Text bold>What should this agent be called?</Text>
				<Text dimColor>
					Give your agent a name that fits its personality.
				</Text>
				<Text />
				<TextInput
					key="agent-name"
					placeholder="e.g. Atlas, Sage, Tek"
					defaultValue={initialName ?? ""}
					onSubmit={(value) => {
						const trimmed = value.trim();
						if (trimmed) {
							setAgentName(trimmed);
							setStep("user-display-name");
						}
					}}
				/>
			</Box>
		);
	}

	if (step === "user-display-name") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>What should {agentName} call you?</Text>
				<Text dimColor>
					Your name or a nickname the agent will use. Press Enter to skip.
				</Text>
				<Text />
				<TextInput
					key="user-display-name"
					placeholder="e.g. your name or a nickname"
					onSubmit={(value) => {
						if (value.trim()) {
							setUserDisplayName(value.trim());
						}
						setStep("personality-preset");
					}}
				/>
			</Box>
		);
	}

	if (step === "personality-preset") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Choose a personality preset for {agentName}:</Text>
				<Text />
				<Select
					options={[
						{
							label:
								"Professional \u2014 Concise, formal, business-appropriate",
							value: "professional",
						},
						{
							label: "Friendly \u2014 Conversational, warm, asks follow-ups",
							value: "friendly",
						},
						{
							label: "Technical \u2014 Detailed, code-heavy, precise",
							value: "technical",
						},
						{
							label:
								"Opinionated \u2014 Direct, has preferences, personality-forward",
							value: "opinionated",
						},
						{
							label: "Custom \u2014 Set up later via conversation",
							value: "custom",
						},
						{
							label: "Skip \u2014 Use default personality",
							value: "skip",
						},
					]}
					onChange={(value) => {
						setPersonalityPreset(value);
						// Check if we have models to offer
						const models = buildAvailableModels();
						if (models.length > 0) {
							setStep("model-override");
						} else {
							setStep("workspace-scope");
						}
					}}
				/>
			</Box>
		);
	}

	if (step === "model-override") {
		const models = buildAvailableModels();
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Choose a model for {agentName}:</Text>
				<Text dimColor>
					Override the global default model for this agent, or use the global
					default.
				</Text>
				<Text />
				<Select
					options={[
						{ label: "Use global default", value: "__global__" },
						...models,
					]}
					onChange={(value) => {
						if (value !== "__global__") {
							setModelOverride(value);
						}
						setStep("workspace-scope");
					}}
				/>
			</Box>
		);
	}

	if (step === "workspace-scope") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Access scope for {agentName}:</Text>
				<Text />
				<Select
					options={[
						{
							label:
								"Full Control \u2014 Agent can access the entire system",
							value: "full",
						},
						{
							label:
								"Limited Control \u2014 Agent restricted to a workspace directory",
							value: "limited",
						},
					]}
					onChange={(value) => {
						setAccessMode(value as "full" | "limited");
						if (value === "limited") {
							setStep("workspace-dir");
						} else {
							setStep("purpose");
						}
					}}
				/>
			</Box>
		);
	}

	if (step === "workspace-dir") {
		const defaultDir = `~/${agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-workspace`;
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Workspace directory for {agentName}:</Text>
				<Text dimColor>
					The agent will be restricted to this directory.
				</Text>
				<Text dimColor>
					Press Enter to use default: <Text bold>{defaultDir}</Text>
				</Text>
				<Text />
				<TextInput
					key="workspace-dir"
					placeholder={defaultDir}
					onSubmit={(value) => {
						setWorkspaceDir(value.trim() || defaultDir);
						setStep("purpose");
					}}
				/>
			</Box>
		);
	}

	if (step === "purpose") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>
					Describe this agent's purpose in a few words:
				</Text>
				<Text dimColor>
					e.g. 'coding assistant', 'research helper'. Press Enter to skip.
				</Text>
				<Text />
				<TextInput
					key="purpose"
					placeholder=""
					onSubmit={(value) => {
						if (value.trim()) {
							setPurpose(value.trim());
						}
						setStep("summary");
					}}
				/>
			</Box>
		);
	}

	if (step === "summary") {
		const presetLabel =
			personalityPreset === "custom"
				? "Custom (set up on first chat)"
				: personalityPreset === "skip"
					? "Default"
					: personalityPreset.charAt(0).toUpperCase() +
						personalityPreset.slice(1);

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					Agent Summary
				</Text>
				<Text />
				<Text>
					Name: <Text bold>{agentName}</Text>
				</Text>
				{userDisplayName && (
					<Text>
						Calls you: <Text bold>{userDisplayName}</Text>
					</Text>
				)}
				<Text>
					Personality: <Text bold>{presetLabel}</Text>
				</Text>
				{modelOverride && (
					<Text>
						Model: <Text bold>{modelOverride}</Text>
					</Text>
				)}
				<Text>
					Access:{" "}
					<Text bold>
						{accessMode === "full" ? "Full Control" : "Limited Control"}
					</Text>
				</Text>
				{workspaceDir && (
					<Text>
						Workspace: <Text bold>{workspaceDir}</Text>
					</Text>
				)}
				{purpose && (
					<Text>
						Purpose: <Text bold>{purpose}</Text>
					</Text>
				)}
				<Text />
				<Text dimColor>Press Enter to create agent...</Text>
				<TextInput
					placeholder=""
					onSubmit={() => {
						setStep("done");
						onComplete({
							agentName,
							userDisplayName: userDisplayName || undefined,
							personalityPreset,
							modelOverride,
							accessMode,
							workspaceDir: workspaceDir || undefined,
							purpose: purpose || undefined,
						});
					}}
				/>
			</Box>
		);
	}

	// step === "done"
	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="green">
				Agent "{agentName}" created!
			</Text>
		</Box>
	);
}
