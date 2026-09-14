/**
 * Shared shape for `useActionState` forms in the submission and review flows.
 * Kept out of the `"use server"` modules, which may only export async functions.
 */
export type ResourceFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

export const EMPTY_RESOURCE_FORM_STATE: ResourceFormState = { error: null };
