import type { ModelMessage } from "ai";

export interface ContextSection {
	name: string;
	content: string;
	byteCount: number;
	tokenEstimate: number;
	costEstimate: number;
}

export interface AssembledContext {
	sections: ContextSection[];
	totals: {
		byteCount: number;
		tokenEstimate: number;
		costEstimate: number;
	};
	messages: ModelMessage[];
	system?: string;
}
