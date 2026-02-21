import { describe, it, expect } from "vitest";
import { ClientMessageSchema, ServerMessageSchema } from "./protocol.js";

// ── Client Message Fixtures ──────────────────────────────────────────

const CLIENT_MESSAGE_FIXTURES: Record<string, unknown> = {
	"chat.send": {
		type: "chat.send",
		id: "c1",
		content: "Hello world",
		model: "claude-3",
		agentId: "default",
	},
	"context.inspect": {
		type: "context.inspect",
		id: "c2",
		sessionId: "sess-1",
	},
	"usage.query": {
		type: "usage.query",
		id: "c3",
	},
	"session.list": {
		type: "session.list",
		id: "c4",
	},
	"chat.route.confirm": {
		type: "chat.route.confirm",
		id: "c5",
		requestId: "req-1",
		accept: true,
	},
	"memory.search": {
		type: "memory.search",
		id: "c6",
		query: "previous conversation",
		topK: 5,
	},
	"thread.create": {
		type: "thread.create",
		id: "c7",
		title: "New Thread",
	},
	"thread.list": {
		type: "thread.list",
		id: "c8",
	},
	"thread.update": {
		type: "thread.update",
		id: "c9",
		threadId: "t-1",
		title: "Updated Thread",
	},
	"prompt.set": {
		type: "prompt.set",
		id: "c10",
		name: "system",
		content: "You are helpful",
	},
	"prompt.list": {
		type: "prompt.list",
		id: "c11",
	},
	"claude-code.start": {
		type: "claude-code.start",
		id: "c12",
		prompt: "Fix the bug",
		cwd: "/home/user/project",
	},
	"claude-code.abort": {
		type: "claude-code.abort",
		id: "c13",
		sessionId: "sess-2",
	},
	"tool.approval.response": {
		type: "tool.approval.response",
		id: "c14",
		toolCallId: "tc-1",
		approved: true,
	},
	"preflight.approval": {
		type: "preflight.approval",
		id: "c15",
		requestId: "req-2",
		approved: true,
	},
	"terminal.snapshot": {
		type: "terminal.snapshot",
		id: "c16",
		sessionId: "sess-3",
		content: "$ ls\nfoo bar",
		timestamp: 1700000000,
	},
	"terminal.control.grant": {
		type: "terminal.control.grant",
		id: "c17",
		sessionId: "sess-3",
	},
	"terminal.control.revoke": {
		type: "terminal.control.revoke",
		id: "c18",
		sessionId: "sess-3",
	},
	"workflow.trigger": {
		type: "workflow.trigger",
		id: "c19",
		workflowId: "wf-1",
	},
	"workflow.approval": {
		type: "workflow.approval",
		id: "c20",
		executionId: "ex-1",
		stepId: "step-1",
		approved: true,
	},
	"workflow.list": {
		type: "workflow.list",
		id: "c21",
	},
	"workflow.execution.list": {
		type: "workflow.execution.list",
		id: "c22",
	},
	"schedule.create": {
		type: "schedule.create",
		id: "c23",
		name: "Daily check",
		cronExpression: "0 9 * * *",
	},
	"schedule.update": {
		type: "schedule.update",
		id: "c24",
		scheduleId: "sch-1",
		enabled: false,
	},
	"schedule.delete": {
		type: "schedule.delete",
		id: "c25",
		scheduleId: "sch-1",
	},
	"schedule.list": {
		type: "schedule.list",
		id: "c26",
	},
	"heartbeat.configure": {
		type: "heartbeat.configure",
		id: "c27",
		heartbeatPath: "/health",
		interval: 30,
		enabled: true,
	},
	"soul.evolution.response": {
		type: "soul.evolution.response",
		id: "c28",
		requestId: "req-3",
		approved: true,
	},
};

// ── Server Message Fixtures ──────────────────────────────────────────

const SERVER_MESSAGE_FIXTURES: Record<string, unknown> = {
	"chat.stream.start": {
		type: "chat.stream.start",
		requestId: "req-1",
		sessionId: "sess-1",
		model: "claude-3",
	},
	"chat.stream.delta": {
		type: "chat.stream.delta",
		requestId: "req-1",
		delta: "Hello ",
	},
	"chat.stream.end": {
		type: "chat.stream.end",
		requestId: "req-1",
		usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
		cost: { inputCost: 0.001, outputCost: 0.002, totalCost: 0.003 },
	},
	"chat.route.propose": {
		type: "chat.route.propose",
		requestId: "req-1",
		sessionId: "sess-1",
		routing: {
			tier: "high",
			provider: "anthropic",
			model: "claude-3",
			reason: "Complex task",
			confidence: 0.95,
		},
		alternatives: [
			{ provider: "openai", model: "gpt-4", tier: "high" },
		],
	},
	"context.inspection": {
		type: "context.inspection",
		requestId: "req-1",
		sections: [
			{
				name: "system",
				content: "You are helpful",
				byteCount: 15,
				tokenEstimate: 4,
				costEstimate: 0.0001,
			},
		],
		totals: { byteCount: 15, tokenEstimate: 4, costEstimate: 0.0001 },
	},
	"usage.report": {
		type: "usage.report",
		requestId: "req-1",
		perModel: {
			"claude-3": {
				inputTokens: 100,
				outputTokens: 200,
				totalTokens: 300,
				totalCost: 0.01,
				requestCount: 5,
			},
		},
		grandTotal: { totalCost: 0.01, totalTokens: 300, requestCount: 5 },
	},
	error: {
		type: "error",
		code: "INVALID_REQUEST",
		message: "Missing required field",
	},
	"session.created": {
		type: "session.created",
		sessionId: "sess-1",
		sessionKey: "key-1",
	},
	"session.list": {
		type: "session.list",
		requestId: "req-1",
		sessions: [
			{
				sessionId: "sess-1",
				sessionKey: "key-1",
				model: "claude-3",
				createdAt: "2026-01-01T00:00:00Z",
				messageCount: 10,
			},
		],
	},
	"memory.search.result": {
		type: "memory.search.result",
		id: "s1",
		results: [
			{
				content: "Previous conversation about testing",
				memoryType: "conversation",
				distance: 0.15,
				createdAt: "2026-01-01T00:00:00Z",
			},
		],
	},
	"thread.created": {
		type: "thread.created",
		id: "s2",
		thread: {
			id: "t-1",
			title: "New Thread",
			createdAt: "2026-01-01T00:00:00Z",
		},
	},
	"thread.list.result": {
		type: "thread.list.result",
		id: "s3",
		threads: [
			{
				id: "t-1",
				title: "Thread 1",
				systemPrompt: null,
				archived: null,
				createdAt: "2026-01-01T00:00:00Z",
				lastActiveAt: "2026-01-02T00:00:00Z",
			},
		],
	},
	"thread.updated": {
		type: "thread.updated",
		id: "s4",
		threadId: "t-1",
	},
	"prompt.set.result": {
		type: "prompt.set.result",
		id: "s5",
		promptId: 1,
	},
	"prompt.list.result": {
		type: "prompt.list.result",
		id: "s6",
		prompts: [
			{
				id: 1,
				name: "system",
				content: "You are helpful",
				isActive: true,
				priority: 1,
				createdAt: "2026-01-01T00:00:00Z",
			},
		],
	},
	"tool.call": {
		type: "tool.call",
		requestId: "req-1",
		toolCallId: "tc-1",
		toolName: "read_file",
		args: { path: "/tmp/test.txt" },
	},
	"tool.result": {
		type: "tool.result",
		requestId: "req-1",
		toolCallId: "tc-1",
		toolName: "read_file",
		result: "file contents",
	},
	"tool.error": {
		type: "tool.error",
		requestId: "req-1",
		toolCallId: "tc-1",
		toolName: "read_file",
		error: "File not found",
	},
	"tool.approval.request": {
		type: "tool.approval.request",
		requestId: "req-1",
		toolCallId: "tc-1",
		toolName: "write_file",
		args: { path: "/tmp/out.txt" },
		risk: "high",
	},
	"soul.evolution.propose": {
		type: "soul.evolution.propose",
		requestId: "req-1",
		file: "personality.md",
		section: "tone",
		currentContent: "formal",
		proposedContent: "casual",
		reason: "User prefers casual tone",
	},
	"preflight.checklist": {
		type: "preflight.checklist",
		requestId: "req-1",
		steps: [
			{
				description: "Read config",
				toolName: "read_file",
				risk: "low",
				needsApproval: false,
			},
		],
		estimatedCost: {
			inputTokens: 100,
			outputTokens: 200,
			estimatedUSD: 0.005,
		},
		requiredPermissions: ["file_read"],
		warnings: [],
	},
	"failure.detected": {
		type: "failure.detected",
		requestId: "req-1",
		pattern: "repeated-tool-error",
		description: "Tool failed 3 times",
		suggestedAction: "Try a different approach",
		affectedTool: "write_file",
	},
	"terminal.input": {
		type: "terminal.input",
		requestId: "req-1",
		data: "ls -la\n",
	},
	"terminal.proxy.start": {
		type: "terminal.proxy.start",
		requestId: "req-1",
		command: "bash",
	},
	"workflow.status": {
		type: "workflow.status",
		executionId: "ex-1",
		workflowId: "wf-1",
		status: "running",
		currentStepId: "step-1",
	},
	"workflow.approval.request": {
		type: "workflow.approval.request",
		executionId: "ex-1",
		workflowId: "wf-1",
		stepId: "step-1",
		stepDescription: "Deploy to production",
	},
	"workflow.list.result": {
		type: "workflow.list.result",
		id: "s7",
		workflows: [
			{
				id: "wf-1",
				name: "Deploy",
				description: "Deploy pipeline",
				definitionPath: "/workflows/deploy.yaml",
			},
		],
	},
	"workflow.execution.list.result": {
		type: "workflow.execution.list.result",
		id: "s8",
		executions: [
			{
				id: "ex-1",
				workflowId: "wf-1",
				status: "running",
				currentStepId: "step-1",
				startedAt: "2026-01-01T00:00:00Z",
			},
		],
	},
	"schedule.list.result": {
		type: "schedule.list.result",
		id: "s9",
		schedules: [
			{
				id: "sch-1",
				name: "Daily check",
				cronExpression: "0 9 * * *",
				enabled: true,
			},
		],
	},
	"schedule.created": {
		type: "schedule.created",
		id: "s10",
		scheduleId: "sch-1",
	},
	"schedule.updated": {
		type: "schedule.updated",
		id: "s11",
		scheduleId: "sch-1",
	},
	"heartbeat.alert": {
		type: "heartbeat.alert",
		checks: [
			{
				description: "CPU usage high",
				actionNeeded: true,
				details: "CPU at 95%",
			},
		],
		timestamp: "2026-01-01T00:00:00Z",
	},
	"heartbeat.configured": {
		type: "heartbeat.configured",
		id: "s12",
		scheduleId: "sch-1",
	},
};

// ── Tests ────────────────────────────────────────────────────────────

describe("ClientMessageSchema", () => {
	Object.entries(CLIENT_MESSAGE_FIXTURES).forEach(([type, fixture]) => {
		it(`round-trips "${type}" without data loss`, () => {
			const parsed = ClientMessageSchema.parse(fixture);
			expect(parsed).toEqual(fixture);
		});
	});

	it("rejects unknown message type", () => {
		expect(() =>
			ClientMessageSchema.parse({ type: "nonexistent", id: "1" }),
		).toThrow();
	});

	it("rejects message missing required id field", () => {
		expect(() =>
			ClientMessageSchema.parse({ type: "chat.send", content: "hi" }),
		).toThrow();
	});

	it("covers all 28 ClientMessage variants", () => {
		expect(Object.keys(CLIENT_MESSAGE_FIXTURES)).toHaveLength(28);
	});
});

describe("ServerMessageSchema", () => {
	Object.entries(SERVER_MESSAGE_FIXTURES).forEach(([type, fixture]) => {
		it(`round-trips "${type}" without data loss`, () => {
			const parsed = ServerMessageSchema.parse(fixture);
			expect(parsed).toEqual(fixture);
		});
	});

	it("rejects unknown server message type", () => {
		expect(() =>
			ServerMessageSchema.parse({ type: "nonexistent", requestId: "1" }),
		).toThrow();
	});

	it("covers all 33 ServerMessage variants", () => {
		expect(Object.keys(SERVER_MESSAGE_FIXTURES)).toHaveLength(33);
	});
});
