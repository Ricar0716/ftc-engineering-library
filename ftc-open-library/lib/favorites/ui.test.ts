import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const button = readFileSync(
  new URL("../../components/favorites/favorite-button.tsx", import.meta.url),
  "utf8",
);
const count = readFileSync(
  new URL("../../components/favorites/favorite-count.tsx", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../../components/resources/resource-actions.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const savedPage = readFileSync(
  new URL("../../app/dashboard/favorites/page.tsx", import.meta.url),
  "utf8",
);
const dashboard = readFileSync(new URL("../../app/dashboard/page.tsx", import.meta.url), "utf8");
const card = readFileSync(
  new URL("../../components/resources/resource-card.tsx", import.meta.url),
  "utf8",
);
const profilePage = readFileSync(
  new URL("../../app/(public)/profile/[username]/page.tsx", import.meta.url),
  "utf8",
);

test("the favorite button exposes save, saved, loading, and error states", () => {
  assert.match(button, /☆ Save/);
  assert.match(button, /★ Saved/);
  assert.match(button, /Saving…/);
  assert.match(button, /Removing…/);
  assert.match(button, /Unable to save|result\.error/);
  assert.match(button, /addFavorite/);
  assert.match(button, /removeFavorite/);
  assert.match(button, /loginPath/);
  assert.match(button, /verify\?reason=save/);
});

test("resource detail hosts the button; cards stay free of favorite controls", () => {
  assert.match(actions, /FavoriteButton/);
  assert.match(actions, /FavoriteCount/);
  assert.match(page, /isResourceFavorited/);
  assert.match(page, /favoriteCount/);
  assert.doesNotMatch(card, /FavoriteButton/);
  assert.doesNotMatch(profilePage, /FavoriteButton/);
  assert.doesNotMatch(profilePage, /dashboard\/favorites/);
});

test("saved resources live on the dashboard and reuse ResourceCard", () => {
  assert.match(savedPage, /listOwnPublishedFavorites/);
  assert.match(savedPage, /ResourceGrid/);
  assert.match(savedPage, /No saved resources yet/);
  assert.match(savedPage, /PagePagination/);
  assert.match(savedPage, /requireVerifiedPage/);
  assert.match(dashboard, /\/dashboard\/favorites/);
  assert.match(count, /saves/);
});
