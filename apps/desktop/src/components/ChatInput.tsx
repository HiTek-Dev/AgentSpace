import { useState, useCallback, useRef, useEffect } from "react";

interface ChatInputProps {
	onSend: (text: string) => void;
	disabled: boolean;
}

const MAX_ROWS = 6;

/**
 * Message input bar with auto-growing textarea.
 * Submit on Enter (Shift+Enter for newline).
 */
export function ChatInput({ onSend, disabled }: ChatInputProps) {
	const [text, setText] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Auto-grow textarea
	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		const lineHeight = 20;
		const maxHeight = lineHeight * MAX_ROWS;
		el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
	}, [text]);

	const handleSend = useCallback(() => {
		const trimmed = text.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setText("");
	}, [text, disabled, onSend]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	return (
		<div className="border-t border-gray-700 bg-gray-900 px-4 py-3">
			<div className="flex items-end gap-2 max-w-4xl mx-auto">
				<textarea
					ref={textareaRef}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					placeholder={
						disabled ? "Waiting for connection..." : "Type a message..."
					}
					rows={1}
					className={`flex-1 resize-none bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors ${
						disabled ? "opacity-50 cursor-not-allowed" : ""
					}`}
					style={{ lineHeight: "20px" }}
				/>
				{!disabled && text.trim() && (
					<button
						type="button"
						onClick={handleSend}
						className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors"
						aria-label="Send message"
					>
						<svg
							className="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 12h14M12 5l7 7-7 7"
							/>
						</svg>
					</button>
				)}
			</div>
		</div>
	);
}
