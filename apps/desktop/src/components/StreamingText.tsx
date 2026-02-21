interface StreamingTextProps {
	text: string;
	model?: string | null;
}

/**
 * Displays the currently-streaming assistant response with a blinking cursor
 * and pulsing border to indicate active streaming.
 * Shows a thinking indicator when streaming has started but no text received yet.
 */
export function StreamingText({ text, model }: StreamingTextProps) {
	if (!text) {
		return (
			<div className="flex justify-start mb-3">
				<div className="flex items-center gap-2 px-4 py-2 text-text-secondary text-sm">
					<span className="animate-pulse">●</span> Thinking...
				</div>
			</div>
		);
	}

	return (
		<div className="flex justify-start mb-3">
			<div className="max-w-[75%]">
				<div className="bg-surface-elevated text-text-primary rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed border border-brand-500/30 animate-pulse whitespace-pre-wrap">
					{text}
					<span className="inline-block w-0.5 h-4 bg-brand-400 ml-0.5 align-text-bottom animate-[blink_1s_steps(2)_infinite]" />
				</div>
				{model && (
					<p className="text-[10px] text-text-muted mt-1">
						<span className="bg-surface-overlay text-text-secondary px-1.5 py-0.5 rounded text-[9px]">
							{model}
						</span>
					</p>
				)}
			</div>
		</div>
	);
}
