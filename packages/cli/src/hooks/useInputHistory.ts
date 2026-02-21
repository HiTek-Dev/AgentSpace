import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 100;

export interface InputHistory {
	push: (text: string) => void;
	back: () => string | undefined;
	forward: () => string | undefined;
	current: string | undefined;
}

/**
 * Hook for cycling through previously sent messages using up/down arrows.
 * Maintains an append-only history buffer capped at 100 entries.
 *
 * Cursor sits "past the end" by default (index === history.length),
 * meaning no history item is selected. Pressing back moves toward
 * older messages; pressing forward moves toward newer ones.
 */
export function useInputHistory(): InputHistory {
	const historyRef = useRef<string[]>([]);
	const cursorRef = useRef(0);
	// Tick state solely to trigger re-renders when cursor moves
	const [, setTick] = useState(0);
	const rerender = useCallback(() => setTick((t) => t + 1), []);

	const push = useCallback(
		(text: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;

			const arr = historyRef.current;
			arr.push(trimmed);

			// Cap at MAX_HISTORY entries
			if (arr.length > MAX_HISTORY) {
				arr.splice(0, arr.length - MAX_HISTORY);
			}

			// Reset cursor past end
			cursorRef.current = arr.length;
			rerender();
		},
		[rerender],
	);

	const back = useCallback((): string | undefined => {
		const arr = historyRef.current;
		if (arr.length === 0) return undefined;

		if (cursorRef.current > 0) {
			cursorRef.current -= 1;
			rerender();
		}

		return arr[cursorRef.current];
	}, [rerender]);

	const forward = useCallback((): string | undefined => {
		const arr = historyRef.current;
		if (arr.length === 0) return undefined;

		if (cursorRef.current < arr.length) {
			cursorRef.current += 1;
			rerender();
		}

		// Past the end means "back to empty input"
		if (cursorRef.current >= arr.length) return undefined;
		return arr[cursorRef.current];
	}, [rerender]);

	const current =
		cursorRef.current < historyRef.current.length
			? historyRef.current[cursorRef.current]
			: undefined;

	return { push, back, forward, current };
}
