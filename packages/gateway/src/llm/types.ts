export interface StreamDelta {
	type: "delta";
	text: string;
}

export interface StreamDone {
	type: "done";
	usage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
}

export type StreamChunk = StreamDelta | StreamDone;
