import React from "react";
import { Box, Text, useInput } from "ink";

interface PreflightStep {
	description: string;
	toolName?: string;
	risk: "low" | "medium" | "high";
	needsApproval: boolean;
}

interface PreflightData {
	steps: PreflightStep[];
	estimatedCost: {
		inputTokens: number;
		outputTokens: number;
		estimatedUSD: number;
	};
	requiredPermissions: string[];
	warnings: string[];
}

export interface InlineApprovalProps {
	type: "tool" | "skill" | "preflight";
	toolName?: string;
	toolCallId?: string;
	args?: unknown;
	checklist?: PreflightData;
	onToolResponse?: (approved: boolean, sessionApprove?: boolean) => void;
	onPreflightResponse?: (approved: boolean) => void;
	isActive: boolean;
}

const RISK_COLORS: Record<string, string> = {
	low: "green",
	medium: "yellow",
	high: "red",
};

/**
 * Unified inline approval dialog for the conversation area.
 *
 * Combines the logic from ToolApprovalPrompt, SkillApprovalPrompt, and
 * PreflightChecklist into one component rendered inside ConversationScroll.
 * Input zone stays visible (disabled) while this is active.
 */
export function InlineApproval({
	type,
	toolName,
	args,
	checklist,
	onToolResponse,
	onPreflightResponse,
	isActive,
}: InlineApprovalProps) {
	useInput(
		(input) => {
			const key = input.toLowerCase();
			if (type === "tool" || type === "skill") {
				if (key === "y" && onToolResponse) {
					onToolResponse(true);
				} else if (key === "n" && onToolResponse) {
					onToolResponse(false);
				} else if (key === "s" && type === "tool" && onToolResponse) {
					onToolResponse(true, true);
				}
			} else if (type === "preflight") {
				if (key === "y" && onPreflightResponse) {
					onPreflightResponse(true);
				} else if (key === "n" && onPreflightResponse) {
					onPreflightResponse(false);
				}
			}
		},
		{ isActive },
	);

	if (type === "preflight" && checklist) {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="yellow"
				paddingX={1}
				marginBottom={1}
			>
				<Text bold color="yellow">
					Pre-flight Checklist
				</Text>

				<Box flexDirection="column" marginTop={1}>
					{checklist.steps.map((step, i) => (
						<Box key={`step-${i}`}>
							<Text>
								<Text dimColor>{`${i + 1}. `}</Text>
								<Text
									color={
										RISK_COLORS[step.risk] as
											| "green"
											| "yellow"
											| "red"
									}
								>
									{`[${step.risk.toUpperCase()}] `}
								</Text>
								<Text>{step.description}</Text>
								{step.toolName && (
									<Text dimColor>{` (${step.toolName})`}</Text>
								)}
								{step.needsApproval && (
									<Text color="yellow">{" *approval*"}</Text>
								)}
							</Text>
						</Box>
					))}
				</Box>

				<Box marginTop={1}>
					<Text bold dimColor>
						{"Est. cost: "}
					</Text>
					<Text>
						{`~${checklist.estimatedCost.inputTokens.toLocaleString()} in / ~${checklist.estimatedCost.outputTokens.toLocaleString()} out ($${checklist.estimatedCost.estimatedUSD.toFixed(4)})`}
					</Text>
				</Box>

				{checklist.requiredPermissions.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						<Text bold dimColor>
							Required permissions:
						</Text>
						{checklist.requiredPermissions.map((perm, i) => (
							<Text key={`perm-${i}`} dimColor>
								{`  - ${perm}`}
							</Text>
						))}
					</Box>
				)}

				{checklist.warnings.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						{checklist.warnings.map((warn, i) => (
							<Text key={`warn-${i}`} color="red">
								{`! ${warn}`}
							</Text>
						))}
					</Box>
				)}

				<Box marginTop={1}>
					<Text>
						<Text bold color="green">
							{"[Y]"}
						</Text>
						<Text>{" Approve and execute "}</Text>
						<Text bold color="red">
							{"[N]"}
						</Text>
						<Text>{" Cancel"}</Text>
					</Text>
				</Box>
			</Box>
		);
	}

	// Tool or Skill approval
	const isSkill = type === "skill";
	const headerText = isSkill ? "Skill Registration Approval" : "Tool Approval Required";
	const headerColor = isSkill ? "magenta" : "yellow";
	const borderColor = isSkill ? "magenta" : "yellow";

	const argsStr =
		typeof args === "string" ? args : JSON.stringify(args, null, 2);

	// For skill type, extract skill name
	const parsedArgs =
		typeof args === "object" && args !== null
			? (args as Record<string, unknown>)
			: {};
	const skillName =
		isSkill && typeof parsedArgs.name === "string" ? parsedArgs.name : null;

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={borderColor}
			paddingX={1}
			marginBottom={1}
		>
			<Text bold color={headerColor}>
				{headerText}
			</Text>

			<Box marginTop={1}>
				<Text bold color="blue">
					{isSkill ? "Skill: " : "Tool: "}
				</Text>
				<Text bold={isSkill}>{skillName ?? toolName}</Text>
			</Box>

			{isSkill && (
				<Text dimColor>
					The agent wants to register this skill to your workspace.
				</Text>
			)}

			{!isSkill && (
				<Box marginTop={1} flexDirection="column">
					<Text bold dimColor>
						Arguments:
					</Text>
					<Text dimColor>{argsStr}</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text>
					<Text bold color="green">
						{"[Y]"}
					</Text>
					<Text>{" Approve "}</Text>
					<Text bold color="red">
						{"[N]"}
					</Text>
					<Text>{isSkill ? " Deny" : " Deny "}</Text>
					{!isSkill && (
						<>
							<Text bold color="cyan">
								{"[S]"}
							</Text>
							<Text>{" Approve for session"}</Text>
						</>
					)}
				</Text>
			</Box>
		</Box>
	);
}
