import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowedTransitions,
  canTransition,
  contributorCanDelete,
  contributorCanEdit,
  contributorCanSubmit,
  contributorCanWithdraw,
  decisionRequiresMessage,
  isPubliclyVisible,
  statusAfterDecision,
} from "./transitions.ts";
import type { ResourceStatus } from "@/types/resources";

const ALL_STATUSES: ResourceStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "PUBLISHED",
  "REJECTED",
  "ARCHIVED",
];

test("a contributor may submit a draft and resubmit after changes are requested", () => {
  assert.equal(canTransition("contributor", "DRAFT", "PENDING_REVIEW"), true);
  assert.equal(canTransition("contributor", "CHANGES_REQUESTED", "PENDING_REVIEW"), true);
  assert.equal(contributorCanSubmit("DRAFT"), true);
  assert.equal(contributorCanSubmit("CHANGES_REQUESTED"), true);
});

test("a contributor may withdraw a pending submission back to draft", () => {
  assert.equal(canTransition("contributor", "PENDING_REVIEW", "DRAFT"), true);
  assert.equal(contributorCanWithdraw("PENDING_REVIEW"), true);
  assert.equal(contributorCanWithdraw("DRAFT"), false);
});

test("a contributor can never publish, reject, or archive", () => {
  for (const from of ALL_STATUSES) {
    for (const to of ["PUBLISHED", "REJECTED", "ARCHIVED"] as ResourceStatus[]) {
      assert.equal(canTransition("contributor", from, to), false, `${from} -> ${to}`);
    }
  }
});

test("a contributor can never move a published resource", () => {
  assert.deepEqual(allowedTransitions("contributor", "PUBLISHED"), []);
  assert.deepEqual(allowedTransitions("contributor", "REJECTED"), []);
  assert.deepEqual(allowedTransitions("contributor", "ARCHIVED"), []);
});

test("a contributor cannot self-review a pending submission", () => {
  assert.equal(canTransition("contributor", "PENDING_REVIEW", "PUBLISHED"), false);
  assert.equal(canTransition("contributor", "PENDING_REVIEW", "CHANGES_REQUESTED"), false);
  assert.equal(canTransition("contributor", "PENDING_REVIEW", "REJECTED"), false);
});

test("only a Site Admin can act on a pending submission", () => {
  assert.equal(canTransition("admin", "PENDING_REVIEW", "PUBLISHED"), true);
  assert.equal(canTransition("admin", "PENDING_REVIEW", "CHANGES_REQUESTED"), true);
  assert.equal(canTransition("admin", "PENDING_REVIEW", "REJECTED"), true);
});

test("a Site Admin can archive and restore, but not publish a draft directly", () => {
  assert.equal(canTransition("admin", "PUBLISHED", "ARCHIVED"), true);
  assert.equal(canTransition("admin", "ARCHIVED", "PUBLISHED"), true);
  assert.equal(canTransition("admin", "DRAFT", "PUBLISHED"), false);
  assert.equal(canTransition("admin", "CHANGES_REQUESTED", "PUBLISHED"), false);
});

test("a rejected resource is final for this version", () => {
  assert.deepEqual(allowedTransitions("admin", "REJECTED"), []);
  assert.equal(contributorCanEdit("REJECTED"), false);
});

test("only drafts and changes-requested resources are editable or deletable", () => {
  const editable = ALL_STATUSES.filter(contributorCanEdit);
  assert.deepEqual(editable, ["DRAFT", "CHANGES_REQUESTED"]);
  const deletable = ALL_STATUSES.filter(contributorCanDelete);
  assert.deepEqual(deletable, ["DRAFT", "CHANGES_REQUESTED"]);
});

test("only published resources are publicly visible", () => {
  const visible = ALL_STATUSES.filter(isPubliclyVisible);
  assert.deepEqual(visible, ["PUBLISHED"]);
});

test("decisions map to the expected status and message requirement", () => {
  assert.equal(statusAfterDecision("APPROVED"), "PUBLISHED");
  assert.equal(statusAfterDecision("CHANGES_REQUESTED"), "CHANGES_REQUESTED");
  assert.equal(statusAfterDecision("REJECTED"), "REJECTED");
  assert.equal(decisionRequiresMessage("APPROVED"), false);
  assert.equal(decisionRequiresMessage("CHANGES_REQUESTED"), true);
  assert.equal(decisionRequiresMessage("REJECTED"), true);
});
