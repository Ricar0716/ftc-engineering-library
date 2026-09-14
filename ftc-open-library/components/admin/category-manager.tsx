"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createCategory,
  deleteCategory,
  setCategoryActive,
  updateCategory,
  type CategoryActionState,
} from "@/lib/admin/category-actions";
import { adminCategoriesPath } from "@/lib/admin/category-search";
import { CATEGORY_TREE_MAX_DEPTH, getCategoryBreadcrumb } from "@/lib/categories/tree";
import { suggestCategorySlug } from "@/lib/categories/slug";
import { parentOptions } from "@/lib/categories/validation";
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPES } from "@/lib/constants/resources";
import { cn } from "@/lib/utils/cn";
import type { Category, CategoryTreeNode } from "@/types/categories";
import type { ResourceType } from "@/types/resources";

const initialAction: CategoryActionState = { error: null };

function TreeItems({
  nodes,
  selectedId,
  resourceType,
  depth,
}: {
  nodes: readonly CategoryTreeNode[];
  selectedId: string | null;
  resourceType: ResourceType;
  depth: number;
}) {
  if (nodes.length === 0 || depth > CATEGORY_TREE_MAX_DEPTH) {
    return null;
  }

  return (
    <ul className={depth === 0 ? "flex flex-col gap-0.5" : "mt-0.5 flex flex-col gap-0.5 border-l border-line pl-3"}>
      {nodes.map((node) => {
        const selected = selectedId === node.id;
        return (
          <li key={node.id} className="min-w-0">
            <Link
              href={adminCategoriesPath({ type: resourceType, id: node.id })}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                selected ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-canvas",
              )}
            >
              <span className="min-w-0 truncate">{node.name}</span>
              {!node.isActive ? (
                <Badge tone="neutral" className="shrink-0 normal-case tracking-normal">
                  Inactive
                </Badge>
              ) : null}
            </Link>
            {node.children.length > 0 ? (
              <TreeItems
                nodes={node.children}
                selectedId={selectedId}
                resourceType={resourceType}
                depth={depth + 1}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function parentLabel(categories: readonly Category[], id: string): string {
  const crumbs = getCategoryBreadcrumb(categories, id).map((item) => item.name);
  return crumbs.join(" / ") || id;
}

function CategoryForm({
  categories,
  resourceType,
  selected,
  mode,
  defaultParentId,
  childCount,
  resourceCount,
}: {
  categories: readonly Category[];
  resourceType: ResourceType;
  selected: Category | null;
  mode: "edit" | "create";
  defaultParentId: string | null;
  childCount: number;
  resourceCount: number | null;
}) {
  const creating = mode === "create" || !selected;
  const current = creating ? null : selected;
  const [name, setName] = useState(current?.name ?? "");
  const [slug, setSlug] = useState(current?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!creating);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteHintId = useId();

  const [saveState, saveAction, savePending] = useActionState(
    creating ? createCategory : updateCategory,
    initialAction,
  );
  const [activeState, activeAction, activePending] = useActionState(setCategoryActive, initialAction);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCategory, initialAction);

  const parents = parentOptions(categories, resourceType, current?.id);
  const canDelete = !creating && childCount === 0 && resourceCount === 0;
  const error = saveState.error || activeState.error || deleteState.error;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-medium text-ink">{creating ? "New category" : "Selected category"}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {creating
            ? "Creates a database row for this Resource Type. Public filters pick it up automatically."
            : "Edits apply to this category id. Resource Type cannot be changed after creation."}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <form action={saveAction} className="flex flex-col gap-4">
        {current ? <input type="hidden" name="id" value={current.id} /> : null}
        <input type="hidden" name="resourceType" value={resourceType} />

        <Input
          label="Name"
          name="name"
          value={name}
          required
          maxLength={80}
          autoComplete="off"
          onChange={(event) => {
            const next = event.target.value;
            setName(next);
            if (!slugTouched) {
              setSlug(suggestCategorySlug(next));
            }
          }}
        />

        <Input
          label="Slug"
          name="slug"
          value={slug}
          required
          maxLength={80}
          autoComplete="off"
          hint="Unique among siblings of this Resource Type."
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
        />

        <Textarea
          label="Description"
          name="description"
          defaultValue={current?.description ?? ""}
          maxLength={500}
          hint="Optional. Not shown on a public landing page yet."
        />

        <Select
          label="Parent"
          name="parentId"
          defaultValue={current?.parentId ?? defaultParentId ?? "none"}
          hint="Only categories of this Resource Type can be parents."
        >
          <option value="none">None (root)</option>
          {parents.map((category) => (
            <option key={category.id} value={category.id}>
              {parentLabel(categories, category.id)}
            </option>
          ))}
        </Select>

        <Input
          label="Sort order"
          name="sortOrder"
          type="number"
          inputMode="numeric"
          defaultValue={String(current?.sortOrder ?? 0)}
          hint="Lower numbers appear first among siblings. Name is the tie-breaker."
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-ink">Resource Type</legend>
          <p className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink">
            {RESOURCE_TYPE_LABELS[resourceType]}
          </p>
          <p className="text-sm text-ink-muted">
            {creating
              ? "Taken from the selected type tab. Switch tabs before creating a different tree."
              : "Locked after creation so children and resources cannot be stranded on the wrong type."}
          </p>
        </fieldset>

        <div className="flex items-start gap-2">
          <input
            id="category-active"
            name="isActive"
            type="checkbox"
            defaultChecked={current?.isActive ?? true}
            className="mt-1 size-4 rounded border-line text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <label htmlFor="category-active" className="text-sm text-ink">
            Active
            <span className="mt-0.5 block text-ink-muted">
              Inactive categories stay in the database but are hidden from public browsing and filters.
            </span>
          </label>
        </div>

        <Button type="submit" disabled={savePending}>
          {savePending ? "Saving…" : creating ? "Create category" : "Save changes"}
        </Button>
      </form>

      {!creating && current ? (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <form action={activeAction}>
            <input type="hidden" name="id" value={current.id} />
            <input type="hidden" name="nextActive" value={current.isActive ? "false" : "true"} />
            <Button type="submit" variant="secondary" disabled={activePending}>
              {activePending
                ? "Updating…"
                : current.isActive
                  ? "Deactivate"
                  : "Reactivate"}
            </Button>
          </form>
          <p className="text-sm text-ink-muted">
            Prefer deactivating over deleting. Existing Resources keep their reference when a category is
            inactive.
          </p>

          <div className="rounded-md border border-line bg-canvas p-3">
            <p className="text-sm font-medium text-ink">Delete</p>
            <p id={deleteHintId} className="mt-1 text-sm text-ink-muted">
              {childCount > 0
                ? `This category has ${childCount} ${childCount === 1 ? "child" : "children"}. Move or delete them first.`
                : resourceCount === null
                  ? "Could not check Resource references. Deletion is blocked until that check succeeds."
                  : resourceCount > 0
                    ? `This category is referenced by ${resourceCount} ${resourceCount === 1 ? "Resource" : "Resources"}. Reassign them first. Resources will not be cascade-deleted.`
                    : `Delete “${current.name}”? This is available because this category has no Resources or child categories.`}
            </p>
            {canDelete ? (
              confirmDelete ? (
                <form action={deleteAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={current.id} />
                  <Button type="submit" variant="danger" disabled={deletePending} aria-describedby={deleteHintId}>
                    {deletePending ? "Deleting…" : `Delete “${current.name}”`}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <Button
                  className="mt-3"
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmDelete(true)}
                  aria-describedby={deleteHintId}
                >
                  Delete…
                </Button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CategoryManager({
  resourceType,
  categories,
  tree,
  selected,
  mode,
  defaultParentId,
  childCount,
  resourceCount,
}: {
  resourceType: ResourceType;
  categories: readonly Category[];
  tree: readonly CategoryTreeNode[];
  selected: Category | null;
  mode: "edit" | "create";
  defaultParentId: string | null;
  childCount: number;
  resourceCount: number | null;
}) {
  const typeLabel = RESOURCE_TYPE_LABELS[resourceType];

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1" aria-label="Resource Type">
        {RESOURCE_TYPES.map((type) => {
          const active = type === resourceType;
          return (
            <Link
              key={type}
              href={adminCategoriesPath({ type })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active ? "bg-accent text-white" : "border border-line bg-surface text-ink hover:bg-canvas",
              )}
            >
              {RESOURCE_TYPE_LABELS[type]}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap gap-2">
        <Link
          href={adminCategoriesPath({ type: resourceType, mode: "create" })}
          className="inline-flex h-10 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          New root category
        </Link>
        {selected ? (
          <Link
            href={adminCategoriesPath({ type: resourceType, mode: "create", parent: selected.id })}
            className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Add child under {selected.name}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-medium text-ink">{typeLabel} tree</h2>
          <p className="mt-1 text-sm text-ink-muted">Includes inactive categories. Public browse hides those.</p>
          <div className="mt-3 min-w-0 overflow-x-auto">
            {tree.length === 0 ? (
              <EmptyState
                title={`No ${typeLabel} categories yet.`}
                description="Create a root category to start this Resource Type’s taxonomy. Nothing is seeded automatically."
              />
            ) : (
              <TreeItems nodes={tree} selectedId={selected?.id ?? null} resourceType={resourceType} depth={0} />
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-line bg-surface p-4">
          {mode === "edit" && !selected && tree.length > 0 ? (
            <p className="text-sm text-ink-muted">Select a category to edit it, or create a new root.</p>
          ) : (
            <CategoryForm
              key={`${mode}-${selected?.id ?? "new"}-${defaultParentId ?? "root"}`}
              categories={categories}
              resourceType={resourceType}
              selected={selected}
              mode={mode === "create" || tree.length === 0 ? "create" : mode}
              defaultParentId={defaultParentId}
              childCount={childCount}
              resourceCount={resourceCount}
            />
          )}
        </section>
      </div>
    </div>
  );
}
