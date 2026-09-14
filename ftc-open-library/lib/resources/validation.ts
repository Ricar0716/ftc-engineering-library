import { z } from "zod";
import { RESOURCE_TYPES } from "../constants/resources.ts";
import { isUuid } from "../utils/id.ts";

/**
 * Server-side validation for contributor submissions.
 *
 * Draft rules are intentionally lighter than submission rules: a contributor may
 * save an unfinished resource. The full publication checks live in
 * `public.submit_resource_for_review()` and are re-run by `public.review_resource()`
 * at approval time, so nothing here is the only line of defence.
 */
export const TITLE_MIN_DRAFT = 3;
export const TITLE_MIN_SUBMIT = 6;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN_DRAFT = 10;
export const DESCRIPTION_MIN_SUBMIT = 60;
export const DESCRIPTION_MAX = 8000;
export const REVIEW_MESSAGE_MIN = 10;
export const REVIEW_MESSAGE_MAX = 2000;
export const MAX_TAGS_PER_RESOURCE = 8;

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .refine((value) => value === null || isUuid(value), "Select a valid option.")
  .nullable();

const collapseWhitespace = (value: string) => value.replace(/\r\n/g, "\n").trim();

export const resourceDraftSchema = z.object({
  resourceType: z.enum(RESOURCE_TYPES),
  title: z
    .string()
    .transform(collapseWhitespace)
    .pipe(
      z
        .string()
        .min(TITLE_MIN_DRAFT, `Give the resource a title of at least ${TITLE_MIN_DRAFT} characters.`)
        .max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`),
    ),
  description: z
    .string()
    .transform(collapseWhitespace)
    .pipe(
      z
        .string()
        .min(
          DESCRIPTION_MIN_DRAFT,
          `Add at least ${DESCRIPTION_MIN_DRAFT} characters of description.`,
        )
        .max(DESCRIPTION_MAX, `Keep the description under ${DESCRIPTION_MAX} characters.`),
    ),
  categoryId: optionalUuid,
  seasonId: optionalUuid,
  licenseId: optionalUuid,
  teamId: optionalUuid,
  tagIds: z
    .array(z.string())
    .max(MAX_TAGS_PER_RESOURCE, `Choose at most ${MAX_TAGS_PER_RESOURCE} tags.`)
    .refine((ids) => ids.every(isUuid), "Select existing tags only."),
});

export type ResourceDraftInput = z.infer<typeof resourceDraftSchema>;

export const reviewDecisionSchema = z
  .object({
    resourceId: z.string().refine(isUuid, "Select a valid resource."),
    decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
    message: z
      .string()
      .transform(collapseWhitespace)
      .pipe(z.string().max(REVIEW_MESSAGE_MAX, "Keep the review note under 2000 characters.")),
  })
  .refine(
    (value) => value.decision === "APPROVED" || value.message.length >= REVIEW_MESSAGE_MIN,
    {
      path: ["message"],
      message: `Explain the decision in at least ${REVIEW_MESSAGE_MIN} characters.`,
    },
  );

export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;

export type FieldErrors = Record<string, string>;

export function firstFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    if (!(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

/** Checks that block `Submit for review`, surfaced before the round trip. */
export type SubmissionBlocker =
  | "title_too_short"
  | "description_too_short"
  | "license_required"
  | "category_required"
  | "files_required"
  | "rights_required";

export const SUBMISSION_BLOCKER_MESSAGES: Record<SubmissionBlocker, string> = {
  title_too_short: `The title must be at least ${TITLE_MIN_SUBMIT} characters.`,
  description_too_short: `The description must be at least ${DESCRIPTION_MIN_SUBMIT} characters.`,
  license_required: "Choose a license before submitting.",
  category_required: "Choose a category before submitting.",
  files_required: "Upload at least one file before submitting.",
  rights_required: "Confirm you have the right to share this content.",
};

export type SubmissionReadinessInput = {
  title: string;
  description: string;
  licenseId: string | null;
  categoryId: string | null;
  categoryRequired: boolean;
  fileCount: number;
};

export function submissionBlockers(input: SubmissionReadinessInput): SubmissionBlocker[] {
  const blockers: SubmissionBlocker[] = [];

  if (input.title.trim().length < TITLE_MIN_SUBMIT) {
    blockers.push("title_too_short");
  }
  if (input.description.trim().length < DESCRIPTION_MIN_SUBMIT) {
    blockers.push("description_too_short");
  }
  if (!input.licenseId) {
    blockers.push("license_required");
  }
  if (input.categoryRequired && !input.categoryId) {
    blockers.push("category_required");
  }
  if (input.fileCount < 1) {
    blockers.push("files_required");
  }

  return blockers;
}
