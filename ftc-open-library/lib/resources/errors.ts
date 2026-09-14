/**
 * Translates errors raised by the moderation RPCs into contributor-facing text.
 *
 * The database raises `ftc:<code>` so the wording lives in one place and raw SQL
 * text never reaches the browser.
 */
const MESSAGES: Record<string, string> = {
  not_found: "That resource no longer exists.",
  not_authorized: "You do not have permission to do that.",
  verification_required: "Verify your email before submitting resources.",
  not_editable: "This resource cannot be edited in its current status.",
  not_pending: "This submission is no longer awaiting review.",
  draft_required: "New resources must start as a draft.",
  pending_frozen: "This submission is under review. Withdraw it first if you need to make changes.",
  invalid_transition: "That change is not allowed in this status.",
  not_published: "Only a published resource can be archived.",
  not_archived: "Only an archived resource can be restored.",
  invalid_decision: "Choose a valid review decision.",
  message_required: "Explain the decision in at least 10 characters.",
  message_too_long: "Keep the review note under 2000 characters.",
  metadata_incomplete: "The submission is missing required metadata.",
  title_too_short: "The title is too short to submit.",
  description_too_short: "The description is too short to submit.",
  license_required: "Choose a license before submitting.",
  category_required: "Choose a category before submitting.",
  category_invalid: "That category is no longer valid for this resource type.",
  files_required: "Upload at least one file before submitting.",
  rights_required: "Confirm you have the right to share this content.",

  // Upload authorization and quotas (STEP 5.1).
  empty: "Choose a file to upload.",
  name_invalid: "That filename cannot be used. Rename the file and try again.",
  extension_blocked: "That file type is not accepted by FTC Open Library.",
  extension_not_allowed: "That file type is not accepted for this resource type.",
  file_too_large: "This file exceeds the upload limit for this resource type.",
  too_many_files: "This resource has reached its file limit.",
  quota_exceeded: "This resource would go over its total size limit.",
  no_version: "This resource has no version to attach files to.",
  too_many_open_uploads: "Your active upload limit has been reached. Finish or cancel an upload first.",
  storage_quota_exceeded:
    "Your unpublished storage quota is full. Publish or remove some files first.",
  too_many_active_resources:
    "You have reached the maximum number of active drafts. Finish or delete one before starting another.",
  creation_rate_limited: "You have created too many resources recently. Try again in a little while.",
  upload_not_authorized: "That upload was not authorized. Start the upload again.",
  upload_expired: "Your upload session expired. Start the upload again.",
  upload_missing: "The upload did not finish. Try again.",
  object_still_present:
    "That upload is still in storage. Remove the file through the library before cancelling.",
  upload_in_progress: "Finish or cancel the in-progress upload before submitting for review.",
  video_quota_exceeded: "This tutorial already has the maximum amount of video.",
  mime_mismatch: "That file type does not match its contents. Use MP4 or WebM for tutorial video.",
};

const FALLBACK = "Something went wrong. Try again.";

export function publicResourceError(error: { message?: string | null } | null | undefined): string {
  const raw = error?.message ?? "";
  const match = raw.match(/ftc:([a-z_]+)/i);
  if (match) {
    const code = match[1].toLowerCase();
    if (code in MESSAGES) {
      return MESSAGES[code];
    }
  }

  if (/row-level security|permission denied/i.test(raw)) {
    return "You do not have permission to do that.";
  }
  if (/413|entity too large|maximum size|payload too large|file_size_limit/i.test(raw)) {
    return "This file exceeds the current storage limit configured for FTC Open Library.";
  }
  if (/duplicate key|unique constraint/i.test(raw)) {
    return "That value is already in use.";
  }
  if (/violates check constraint|invalid status transition/i.test(raw)) {
    return "That change is not allowed in this status.";
  }

  return FALLBACK;
}
