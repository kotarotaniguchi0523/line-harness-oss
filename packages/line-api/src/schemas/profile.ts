import { z } from "zod";

export const UserProfileSchema = z.object({
	displayName: z.string(),
	userId: z.string(),
	pictureUrl: z.string().url().optional(),
	statusMessage: z.string().optional(),
	language: z.string().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
