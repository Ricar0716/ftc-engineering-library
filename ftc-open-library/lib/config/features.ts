/**
 * Public Beta feature switches.
 *
 * These hide or pause product surfaces. They are not authorization.
 * RLS, session checks, and existing RPCs still apply when a flag is off.
 */
export function isDiscussionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DISCUSSION_ENABLED === "true";
}
