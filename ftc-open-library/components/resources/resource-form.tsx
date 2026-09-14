"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryOption } from "@/lib/categories/options";
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_PURPOSE,
} from "@/lib/constants/resources";
import { UPLOAD_GUIDANCE } from "@/lib/config/uploads";
import { EMPTY_RESOURCE_FORM_STATE, type ResourceFormState } from "@/lib/resources/form-state";
import {
  DESCRIPTION_MAX,
  MAX_TAGS_PER_RESOURCE,
  TITLE_MAX,
} from "@/lib/resources/validation";
import type { ResourceType } from "@/types/resources";

export type ResourceFormOptions = {
  categoriesByType: Record<ResourceType, CategoryOption[]>;
  licenses: { id: string; name: string }[];
  seasons: { id: string; label: string }[];
  teams: { id: string; name: string; teamNumber: string }[];
  tags: { id: string; name: string }[];
};

export type ResourceFormValues = {
  resourceType: ResourceType;
  title: string;
  description: string;
  categoryId: string;
  seasonId: string;
  licenseId: string;
  teamId: string;
  tagIds: string[];
};

type Action = (state: ResourceFormState, formData: FormData) => Promise<ResourceFormState>;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-base font-medium text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function ResourceForm({
  action,
  options,
  initial,
  resourceId,
  submitLabel,
  allowTypeChange,
}: {
  action: Action;
  options: ResourceFormOptions;
  initial: ResourceFormValues;
  resourceId?: string;
  submitLabel: string;
  allowTypeChange: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_RESOURCE_FORM_STATE);
  const [resourceType, setResourceType] = useState<ResourceType>(initial.resourceType);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const errorId = useId();
  const tagsLabelId = useId();

  const categories = options.categoriesByType[resourceType] ?? [];
  const fieldErrors = state.fieldErrors ?? {};

  function onTypeChange(next: ResourceType) {
    setResourceType(next);
    // A category always belongs to one Resource Type, so an old pick cannot survive.
    setCategoryId("");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {resourceId ? <input type="hidden" name="resourceId" value={resourceId} /> : null}

      {state.error ? (
        <p
          id={errorId}
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Section
        title="Basic information"
        description="Explain what this is and who it helps. Reviewers read this first."
      >
        <Input
          name="title"
          label="Title"
          required
          maxLength={TITLE_MAX}
          defaultValue={initial.title}
          error={fieldErrors.title}
          hint="A specific name works better than a generic one."
        />
        <Textarea
          name="description"
          label="Description"
          required
          rows={8}
          maxLength={DESCRIPTION_MAX}
          defaultValue={initial.description}
          error={fieldErrors.description}
          hint="At least 60 characters are needed before you can submit for review."
        />
      </Section>

      <Section
        title="Classification"
        description="Categories come from the live taxonomy. If a type has no categories yet, leave it unset."
      >
        <Select
          id="resourceType"
          name={allowTypeChange ? "resourceType" : undefined}
          label="Resource Type"
          required
          value={resourceType}
          disabled={!allowTypeChange}
          onChange={(event) => onTypeChange(event.target.value as ResourceType)}
          hint={
            allowTypeChange
              ? "Changing the type clears the category, because categories belong to one type."
              : "The Resource Type is fixed once a submission has been reviewed."
          }
        >
          {RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {RESOURCE_TYPE_LABELS[type]} — {RESOURCE_TYPE_PURPOSE[type]}
            </option>
          ))}
        </Select>
        {!allowTypeChange ? (
          <input type="hidden" name="resourceType" value={resourceType} />
        ) : null}

        <Select
          name="categoryId"
          label="Category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          hint={
            categories.length === 0
              ? "No categories exist for this Resource Type yet. You can still save and submit."
              : "Pick the most specific category that fits."
          }
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>

        <Select name="seasonId" label="Season (optional)" defaultValue={initial.seasonId}>
          <option value="">Not season specific</option>
          {options.seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.label}
            </option>
          ))}
        </Select>

        <fieldset className="flex flex-col gap-2">
          <legend id={tagsLabelId} className="text-sm font-medium text-ink">
            Tags (optional)
          </legend>
          <p className="text-sm text-ink-muted">
            Choose from existing tags. Contributors cannot create new tags; up to{" "}
            {MAX_TAGS_PER_RESOURCE} may be selected.
          </p>
          {options.tags.length === 0 ? (
            <p className="text-sm text-ink-muted">No tags have been created yet.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {options.tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={tag.id}
                    defaultChecked={initial.tagIds.includes(tag.id)}
                    className="size-4 rounded border-line"
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          )}
          {fieldErrors.tagIds ? <p className="text-sm text-danger">{fieldErrors.tagIds}</p> : null}
        </fieldset>
      </Section>

      <Section
        title="License and attribution"
        description="A license is required before a resource can be submitted for review."
      >
        <Select
          name="licenseId"
          label="License"
          defaultValue={initial.licenseId}
          hint="Pick the license that already applies to your work. FTC Open Library does not give legal advice."
        >
          <option value="">Not chosen yet</option>
          {options.licenses.map((license) => (
            <option key={license.id} value={license.id}>
              {license.name}
            </option>
          ))}
        </Select>

        <Select
          name="teamId"
          label="Team attribution (optional)"
          defaultValue={initial.teamId}
          hint={
            options.teams.length === 0
              ? "You can attribute a resource to a team once you are an owner or admin of one."
              : "Only teams you own or administer are listed."
          }
        >
          <option value="">Personal contribution</option>
          {options.teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.teamNumber} — {team.name}
            </option>
          ))}
        </Select>
      </Section>

      <p className="text-sm text-ink-muted">
        Files for this type: {UPLOAD_GUIDANCE[resourceType]}
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
