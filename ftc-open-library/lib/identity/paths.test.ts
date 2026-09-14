import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contributorHref,
  identityPath,
  parseIdentityPage,
  teamHref,
  teamIdentityLabel,
} from "./paths.ts";

test("identity page numbers stay positive integers", () => {
  assert.equal(parseIdentityPage({}), 1);
  assert.equal(parseIdentityPage({ page: "2" }), 2);
  assert.equal(parseIdentityPage({ page: ["3", "9"] }), 3);
  assert.equal(parseIdentityPage({ page: "0" }), 1);
  assert.equal(parseIdentityPage({ page: "nope" }), 1);
});

test("profile and team URLs stay shareable", () => {
  assert.equal(contributorHref("ada"), "/profile/ada");
  assert.equal(teamHref("12345"), "/teams/12345");
  assert.equal(teamIdentityLabel("12345"), "Team 12345");
  assert.equal(identityPath("/profile/ada", 1), "/profile/ada");
  assert.equal(identityPath("/teams/12345", 2), "/teams/12345?page=2");
});
