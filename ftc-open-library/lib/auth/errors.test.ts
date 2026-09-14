import assert from "node:assert/strict";
import { test } from "node:test";
import { publicAuthError } from "./errors.ts";

test("maps known auth failures to safe copy", () => {
  assert.equal(publicAuthError("Invalid login credentials"), "Incorrect email or password.");
  assert.equal(publicAuthError("Email not confirmed"), "Verify your email before signing in.");
  assert.equal(publicAuthError("User already registered"), "An account with this email already exists.");
  assert.equal(publicAuthError({ message: "Token has expired or is invalid" }), "This link has expired. Request a new one.");
});

test("does not forward unknown provider dumps", () => {
  assert.equal(publicAuthError("relation auth.users does not exist"), "Something went wrong. Try again.");
  assert.equal(publicAuthError(null), "Something went wrong. Try again.");
});
