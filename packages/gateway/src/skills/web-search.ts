import { tool } from "ai";
import { z } from "zod";

interface TavilyResult {
	title: string;
	url: string;
	content: string;
}

interface TavilyResponse {
	answer?: string;
	results: TavilyResult[];
}

/**
 * Create a web search tool using Tavily Search API.
 * Returns structured search results with titles, URLs, and content snippets.
 */
export function createWebSearchTool(apiKey?: string) {
	return tool({
		description: apiKey
			? "Search the web for current information. Returns titles, URLs, and content snippets."
			: "Web search is unavailable (no API key configured).",
		inputSchema: z.object({
			query: z.string().describe("Search query"),
			maxResults: z
				.number()
				.optional()
				.default(5)
				.describe("Maximum number of results to return"),
		}),
		execute: async ({ query, maxResults }) => {
			if (!apiKey) {
				return { error: "Web search unavailable: no Tavily API key configured" };
			}

			try {
				const response = await fetch("https://api.tavily.com/search", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						api_key: apiKey,
						query,
						max_results: maxResults,
						include_answer: true,
					}),
				});

				if (!response.ok) {
					const text = await response.text();
					return { error: `Search failed: ${response.status} ${text}` };
				}

				const res = (await response.json()) as TavilyResponse;
				return {
					answer: res.answer,
					results: res.results.map((r) => ({
						title: r.title,
						url: r.url,
						content: r.content,
					})),
				};
			} catch (err) {
				return {
					error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
				};
			}
		},
	});
}
