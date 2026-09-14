import assert from "node:assert/strict";
import { test } from "node:test";
import { publicResourceError } from "./errors.ts";
import {
  resourceDraftSchema,
  reviewDecisionSchema,
  submissionBlockers,
} from "./validation.ts";

const UUID = "11111111-1111-4111-8111-111111111111";

const draft = {
  resourceType: "CAD",
  title: "Dual flywheel shooter",
  description: "A tuned dual flywheel shooter with printable hoods and a bill of materials.",
  categoryId: "",
  seasonId: "",
  licenseId: "",
  teamId: "",
  tagIds: [] as string[],
};

test("a minimal draft is accepted and trimmed", () => {
  const parsed = resourceDraftSchema.safeParse({ ...draft, title: "  Intake  " });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.title, "Intake");
  assert.equal(parsed.data?.categoryId, null);
});

test("draft rules are lighter than submission rules but still bounded", () => {
  assert.equal(resourceDraftSchema.safeParse({ ...draft, title: "ab" }).success, false);
  assert.equal(resourceDraftSchema.safeParse({ ...draft, description: "short" }).success, false);
  assert.equal(
    resourceDraftSchema.safeParse({ ...draft, title: "x".repeat(200) }).success,
    false,
  );
});

test("only the four supported resource types are accepted", () => {
  for (const resourceType of ["CAD", "CODE", "TUTORIAL", "MODEL"]) {
    assert.equal(resourceDraftSchema.safeParse({ ...draft, resourceType }).success, true);
  }
  for (const resourceType of ["ALGORITHM", "TOOLS", "cad", ""]) {
    assert.equal(resourceDraftSchema.safeParse({ ...draft, resourceType }).success, false);
  }
});

test("client-supplied ids must be uuids", () => {
  assert.equal(resourceDraftSchema.safeParse({ ...draft, categoryId: "intake" }).success, false);
  assert.equal(resourceDraftSchema.safeParse({ ...draft, categoryId: UUID }).success, true);
  assert.equal(resourceDraftSchema.safeParse({ ...draft, tagIds: ["odometry"] }).success, false);
  assert.equal(resourceDraftSchema.safeParse({ ...draft, tagIds: [UUID] }).success, true);
});

test("submission blockers cover every publication requirement", () => {
  const blockers = submissionBlockers({
    title: "Hi",
    description: "too short",
    licenseId: null,
    categoryId: null,
    categoryRequired: true,
    fileCount: 0,
  });
  assert.deepEqual(blockers, [
    "title_too_short",
    "description_too_short",
    "license_required",
    "category_required",
    "files_required",
  ]);
});

test("a complete submission has no blockers", () => {
  assert.deepEqual(
    submissionBlockers({
      title: draft.title,
      description: draft.description,
      licenseId: UUID,
      categoryId: UUID,
      categoryRequired: true,
      fileCount: 1,
    }),
    [],
  );
});

test("an empty taxonomy does not block submission", () => {
  assert.deepEqual(
    submissionBlockers({
      title: draft.title,
      description: draft.description,
      licenseId: UUID,
      categoryId: null,
      categoryRequired: false,
      fileCount: 1,
    }),
    [],
  );
});

test("request-changes and reject require a meaningful note, approve does not", () => {
  assert.equal(
    reviewDecisionSchema.safeParse({ resourceId: UUID, decision: "APPROVED", message: "" }).success,
    true,
  );
  assert.equal(
    reviewDecisionSchema.safeParse({ resourceId: UUID, decision: "REJECTED", message: "no" })
      .success,
    false,
  );
  assert.equal(
    reviewDecisionSchema.safeParse({
      resourceId: UUID,
      decision: "CHANGES_REQUESTED",
      message: "Please add the bill of materials.",
    }).success,
    true,
  );
});

test("review decisions outside the supported set are rejected", () => {
  assert.equal(
    reviewDecisionSchema.safeParse({ resourceId: UUID, decision: "PUBLISHED", message: "" })
      .success,
    false,
  );
  assert.equal(
    reviewDecisionSchema.safeParse({ resourceId: "nope", decision: "APPROVED", message: "" })
      .success,
    false,
  );
});

test("database errors are translated, never leaked verbatim", () => {
  assert.equal(
    publicResourceError({ message: "ftc:not_pending" }),
    "This submission is no longer awaiting review.",
  );
  assert.equal(
    publicResourceError({ message: 'ERROR: ftc:invalid_transition (DRAFT to PUBLISHED)' }),
    "That change is not allowed in this status.",
  );
  assert.equal(
    publicResourceError({ message: "ERROR: ftc:not_editable (status PUBLISHED)" }),
    "This resource cannot be edited in its current status.",
  );
  assert.equal(
    publicResourceError({ message: "new row violates row-level security policy for table" }),
    "You do not have permission to do that.",
  );
  assert.match(publicResourceError({ message: "some internal detail" }), /Something went wrong/);
  assert.equal(publicResourceError(null), "Something went wrong. Try again.");
});
