import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { autoTrackUrls } from "./auto-track-urls.js";

export function registerSendMessage(server: McpServer): void {
	server.tool(
		"send_message",
		"Send a text, image, or flex message to a specific friend. Use messageType 'flex' for rich card layouts, 'image' for image messages.",
		{
			friendId: z.string().describe("The friend's ID to send the message to"),
			content: z
				.string()
				.describe(
					"Message content. For text: plain string. For flex: JSON string of LINE Flex Message. For image: JSON string with { originalContentUrl, previewImageUrl }.",
				),
			messageType: z
				.enum(["text", "image", "flex"])
				.default("text")
				.describe("Message type: 'text' for plain text, 'image' for image message, 'flex' for Flex Message JSON"),
		},
		async ({ friendId, content, messageType }) => {
			try {
				const client = getClient();

				// Auto-track URLs in flex messages
				const { content: trackedContent } = await autoTrackUrls(
					client,
					content,
					messageType,
					`DM to ${friendId.slice(0, 8)}`,
				);

				const result = await client.friends.sendMessage(friendId, trackedContent, messageType);
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ success: true, messageId: result.messageId }, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ success: false, error: String(error) }, null, 2),
						},
					],
					isError: true,
				};
			}
		},
	);
}
