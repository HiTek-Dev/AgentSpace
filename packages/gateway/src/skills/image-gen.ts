import { tool } from "ai";
import { z } from "zod";
import OpenAI from "openai";

/**
 * Create an image generation tool using OpenAI's gpt-image-1.5 model.
 * Returns image URL or base64 data URL.
 */
export function createImageGenTool(apiKey?: string) {
	return tool({
		description: apiKey
			? "Generate an image from a text description using OpenAI's image generation model."
			: "OpenAI image generation is unavailable (no API key configured).",
		inputSchema: z.object({
			prompt: z
				.string()
				.describe("Detailed description of the image to generate"),
			size: z
				.enum(["1024x1024", "1024x1792", "1792x1024"])
				.optional()
				.default("1024x1024")
				.describe("Image dimensions"),
			quality: z
				.enum(["low", "medium", "high"])
				.optional()
				.default("medium")
				.describe("Image quality level"),
		}),
		execute: async ({ prompt, size, quality }) => {
			if (!apiKey) {
				return {
					error: "Image generation unavailable: no OpenAI API key configured",
				};
			}

			try {
				const openai = new OpenAI({ apiKey });
				const result = await openai.images.generate({
					model: "gpt-image-1.5",
					prompt,
					size,
					quality,
					n: 1,
				});

				const image = result.data?.[0];
				return {
					url: image?.url,
					revisedPrompt: image?.revised_prompt,
				};
			} catch (err) {
				return {
					error: `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
				};
			}
		},
	});
}

/**
 * Create an image generation tool using Stability AI (SD3.5 Large).
 * Returns base64 data URL.
 */
export function createStabilityImageGenTool(apiKey?: string) {
	return tool({
		description: apiKey
			? "Generate an image from a text description using Stability AI."
			: "Stability AI image generation is unavailable (no API key configured).",
		inputSchema: z.object({
			prompt: z
				.string()
				.describe("Detailed description of the image to generate"),
			negativePrompt: z
				.string()
				.optional()
				.describe("What to exclude from the image"),
			aspectRatio: z
				.enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
				.optional()
				.default("1:1")
				.describe("Image aspect ratio"),
		}),
		execute: async ({ prompt, negativePrompt, aspectRatio }) => {
			if (!apiKey) {
				return {
					error: "Stability image generation unavailable: no Stability API key configured",
				};
			}

			try {
				const formData = new FormData();
				formData.append("prompt", prompt);
				if (negativePrompt) {
					formData.append("negative_prompt", negativePrompt);
				}
				formData.append("aspect_ratio", aspectRatio ?? "1:1");
				formData.append("output_format", "png");
				formData.append("model", "sd3.5-large");

				const response = await fetch(
					"https://api.stability.ai/v2beta/stable-image/generate/sd3",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiKey}`,
							Accept: "image/*",
						},
						body: formData,
					},
				);

				if (!response.ok) {
					const text = await response.text();
					return {
						error: `Stability image generation failed: ${response.status} ${text}`,
					};
				}

				const buffer = await response.arrayBuffer();
				const base64 = Buffer.from(buffer).toString("base64");
				const dataUrl = `data:image/png;base64,${base64}`;

				return { url: dataUrl };
			} catch (err) {
				return {
					error: `Stability image generation failed: ${err instanceof Error ? err.message : String(err)}`,
				};
			}
		},
	});
}
