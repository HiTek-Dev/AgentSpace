interface StreamingTextProps {
	text: string;
	model?: string | null;
}

/**
 * Displays the currently-streaming assistant response with a blinking cursor
 * and pulsing border to indicate active streaming.
 */
export function StreamingText({ text, model }: StreamingTextProps) {
	if (!text) return null;

	return (
		<div className="flex justify-start mb-3">
			<div className="max-w-[75%]">
				<div className="bg-gray-800 text-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed border border-blue-500/30 animate-pulse whitespace-pre-wrap">
					{text}
					<span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 align-text-bottom animate-[blink_1s_steps(2)_infinite]" />
				</div>
				{model && (
					<p className="text-[10px] text-gray-500 mt-1">
						<span className="bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded text-[9px]">
							{model}
						</span>
					</p>
				)}
			</div>
		</div>
	);
}
