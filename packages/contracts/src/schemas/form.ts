import { z } from "zod";
import { UuidSchema } from "./common.js";

// =============================================================================
// Form — Request Schemas
// =============================================================================

/**
 * Schema for a single form field definition.
 * Used within form creation/update to describe field structure.
 */
export const FormFieldSchema = z.object({
	name: z.string().min(1),
	label: z.string().min(1),
	type: z.string().min(1),
	required: z.boolean().optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

/**
 * Schema for creating a new form.
 * Used by POST /api/forms
 */
export const CreateFormSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	fields: z.array(z.unknown()).optional(),
	onSubmitTagId: z.string().uuid().nullable().optional(),
	onSubmitScenarioId: z.string().uuid().nullable().optional(),
	saveToMetadata: z.boolean().optional(),
});
export type CreateFormRequest = z.infer<typeof CreateFormSchema>;

/**
 * Schema for updating an existing form.
 * Used by PUT /api/forms/:id
 */
export const UpdateFormSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	fields: z.array(z.unknown()).optional(),
	onSubmitTagId: z.string().uuid().nullable().optional(),
	onSubmitScenarioId: z.string().uuid().nullable().optional(),
	saveToMetadata: z.boolean().optional(),
	isActive: z.boolean().optional(),
});
export type UpdateFormRequest = z.infer<typeof UpdateFormSchema>;

/**
 * Schema for submitting a form response (public, used by LIFF).
 * Used by POST /api/forms/:id/submit
 */
export const SubmitFormSchema = z.object({
	lineUserId: z.string().optional(),
	friendId: z.string().uuid().optional(),
	data: z.record(z.unknown()).optional(),
});
export type SubmitFormRequest = z.infer<typeof SubmitFormSchema>;

// =============================================================================
// Form — Entity Schemas (read models)
// =============================================================================

/**
 * Full form entity schema for API responses.
 */
export const FormSchema = z.object({
	id: UuidSchema,
	name: z.string().min(1),
	description: z.string().nullable(),
	fields: z.string().nullable(),
	onSubmitTagId: UuidSchema.nullable(),
	onSubmitScenarioId: UuidSchema.nullable(),
	saveToMetadata: z.boolean(),
	isActive: z.boolean(),
	submitCount: z.number().int().nonnegative(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type Form = z.infer<typeof FormSchema>;

/**
 * Form submission entity schema for API responses.
 */
export const FormSubmissionSchema = z.object({
	id: UuidSchema,
	formId: UuidSchema,
	friendId: UuidSchema.nullable(),
	data: z.string().nullable(),
	createdAt: z.string(),
});
export type FormSubmission = z.infer<typeof FormSubmissionSchema>;
