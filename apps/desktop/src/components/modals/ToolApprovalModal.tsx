interface ToolApprovalModalProps {
	toolName: string;
	toolCallId: string;
	args: unknown;
	risk?: string;
	queueSize: number;
	onResponse: (approved: boolean, sessionApprove?: boolean) => void;
}

const riskColors: Record<string, string> = {
	high: "text-red-400",
	medium: "text-yellow-400",
	low: "text-green-400",
};

export function ToolApprovalModal({
	toolName,
	args,
	risk,
	queueSize,
	onResponse,
}: ToolApprovalModalProps) {
	const argsPreview =
		typeof args === "string" ? args : JSON.stringify(args, null, 2);

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div className="bg-surface-elevated border border-surface-overlay rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold text-text-primary">
						Tool Approval Required
					</h2>
					{queueSize > 1 && (
						<span className="text-xs text-text-secondary">
							1 of {queueSize}
						</span>
					)}
				</div>

				{/* Tool name and risk */}
				<div className="flex items-center gap-2 mb-4">
					<span className="text-sm font-mono text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded">
						{toolName}
					</span>
					{risk && (
						<span
							className={`text-xs font-medium ${riskColors[risk] ?? "text-text-secondary"}`}
						>
							{risk} risk
						</span>
					)}
				</div>

				{/* Args preview */}
				{argsPreview && (
					<pre className="bg-surface-primary rounded-lg p-3 max-h-48 overflow-y-auto text-xs text-text-secondary font-mono whitespace-pre-wrap mb-6">
						{argsPreview}
					</pre>
				)}

				{/* Action buttons */}
				<div className="grid grid-cols-3 gap-3">
					<button
						type="button"
						onClick={() => onResponse(true)}
						className="bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
					>
						Approve
					</button>
					<button
						type="button"
						onClick={() => onResponse(false)}
						className="bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
					>
						Deny
					</button>
					<button
						type="button"
						onClick={() => onResponse(true, true)}
						className="bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
					>
						Session Approve
					</button>
				</div>
			</div>
		</div>
	);
}
