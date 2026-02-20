import { tool } from "ai";
import { z } from "zod";

/**
 * Create a Brave Search tool that searches the web via the Brave Search API.
 * Returns titles, URLs, and descriptions from web search results.
 */
export function createBraveSearchTool(apiKey: string) {
	return tool({
		description:
			"Search the web using Brave Search for current information. Returns titles, URLs, and descriptions.",
		inputSchema: z.object({
			query: z.string().describe("The search query"),
			count: z
				.number()
				.optional()
				.default(5)
				.describe("Number of results to return (max 20)"),
		}),
		execute: async ({ query, count }) => {
			const clampedCount = Math.min(count ?? 5, 20);
			const url = new URL("https://api.search.brave.com/res/v1/web/search");
			url.searchParams.set("q", query);
			url.searchParams.set("count", String(clampedCount));

			try {
				const response = await fetch(url.toString(), {
					headers: {
						Accept: "application/json",
						"X-Subscription-Token": apiKey,
					},
				});

				if (!response.ok) {
					return {
						error: `Brave search failed: ${response.status}`,
					};
				}

				const data = (await response.json()) as {
					web?: {
						results?: Array<{
							title?: string;
							url?: string;
							description?: string;
						}>;
					};
				};

				const results = (data.web?.results ?? []).map((r) => ({
					title: r.title ?? "",
					url: r.url ?? "",
					description: r.description ?? "",
				}));

				return { results };
			} catch (err) {
				return {
					error: `Brave search failed: ${err instanceof Error ? err.message : String(err)}`,
				};
			}
		},
	});
}
