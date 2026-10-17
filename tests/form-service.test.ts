import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, resetTables, seedWorkspace, type TestDb } from "./helpers/pglite";
import { and, eq } from "drizzle-orm";
import { createBlankOnboardingSchema } from "@/lib/forms/blank-schema";
import { DraftConflictError, FormServiceError } from "@/lib/forms/errors";
import {
  archiveForm,
  createForm,
  deleteForm,
  duplicateForm,
  getPublishedFormBySlug,
  getWorkspaceDraft,
  getWorkspaceForm,
  listForms,
  publishForm,
  renameForm,
  restoreForm,
  updateDraft,
} from "@/lib/forms/service";
import { form, formVersion } from "@/lib/db/schema";
import { emmanuelOnboardingV1 } from "@/lib/onboarding/schemas/emmanuel-onboarding-v1";

describe("form service", () => {
  let db: TestDb;
  let client: PGlite;

  beforeAll(async () => {
    const created = await createTestDb();
    db = created.db;
    client = created.client;
  });

  afterEach(async () => {
    await resetTables(db);
  });

  afterAll(async () => {
    await client.close();
  });

  it("creates a form with one draft", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    const draft = await getWorkspaceDraft(db, owner.workspaceId, created.form.id);
    expect(draft.revision).toBe(1);
    expect(created.form.slug).toMatch(/intake-/);
    expect(draft.clientIdentityMapping?.emailFieldKey).toBe("email");
  });

  it("isolates workspaces", async () => {
    const a = await seedWorkspace(db, "a");
    const b = await seedWorkspace(db, "b");
    const created = await createForm(db, { workspaceId: a.workspaceId, name: "Private", source: "blank" });
    await expect(getWorkspaceForm(db, b.workspaceId, created.form.id)).rejects.toBeInstanceOf(FormServiceError);
    await expect(getWorkspaceDraft(db, b.workspaceId, created.form.id)).rejects.toBeInstanceOf(FormServiceError);
    await expect(
      updateDraft(db, { workspaceId: b.workspaceId, formId: created.form.id, expectedRevision: 1, schema: created.draft.schema }),
    ).rejects.toBeInstanceOf(FormServiceError);
    await expect(publishForm(db, { workspaceId: b.workspaceId, formId: created.form.id, userId: b.userId })).rejects.toBeInstanceOf(
      FormServiceError,
    );
    await expect(archiveForm(db, b.workspaceId, created.form.id)).rejects.toBeInstanceOf(FormServiceError);
  });

  it("publishes immutable versions", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, {
      workspaceId: owner.workspaceId,
      name: "V1 copy",
      source: "v1",
      v1Schema: emmanuelOnboardingV1,
    });
    const first = await publishForm(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
    });
    expect(first.version.versionNumber).toBe(1);
    const originalTitle = first.schema.title;
    const nextSchema = { ...created.draft.schema, title: "Edited draft" };
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema: nextSchema,
    });
    const second = await publishForm(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      userId: owner.userId,
    });
    expect(second.version.versionNumber).toBe(2);
    const storedFirst = await db
      .select()
      .from(formVersion)
      .where(and(eq(formVersion.formId, created.form.id), eq(formVersion.versionNumber, 1)))
      .limit(1);
    expect(storedFirst[0]?.schema).toMatchObject({ title: originalTitle });
    const publicForm = await getPublishedFormBySlug(db, created.form.slug);
    expect(publicForm?.schema.title).toBe("Edited draft");
    expect(publicForm?.versionNumber).toBe(2);
    expect(first.version.id).not.toBe(second.version.id);
  });

  it("rejects stale draft revisions", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Rev", source: "blank" });
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema: created.draft.schema,
    });
    await expect(
      updateDraft(db, {
        workspaceId: owner.workspaceId,
        formId: created.form.id,
        expectedRevision: 1,
        schema: created.draft.schema,
      }),
    ).rejects.toBeInstanceOf(DraftConflictError);
  });

  it("archives forms out of the public route", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Live", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await archiveForm(db, owner.workspaceId, created.form.id);
    expect(await getPublishedFormBySlug(db, created.form.slug)).toBeNull();
  });

  it("renames without changing the public slug", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    const renamed = await renameForm(db, owner.workspaceId, created.form.id, "Welcome intake");
    expect(renamed.slug).toBe(created.form.slug);
    expect(renamed.name).toBe("Welcome intake");
  });

  it("duplicates the draft only", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Intake", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    const copy = await duplicateForm(db, owner.workspaceId, created.form.id);
    expect(copy.form.name).toBe("Intake copy");
    expect(copy.form.slug).not.toBe(created.form.slug);
    expect(copy.form.status).toBe("draft");
    expect(copy.draft.schema.storageKey).toBe(`form_${copy.form.id}`);
    const versions = await db.select().from(formVersion).where(eq(formVersion.formId, copy.form.id));
    expect(versions).toHaveLength(0);
  });

  it("refuses to delete published history and restores an archive", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Live", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await expect(deleteForm(db, owner.workspaceId, created.form.id)).rejects.toBeInstanceOf(FormServiceError);
    await archiveForm(db, owner.workspaceId, created.form.id);
    expect(await getPublishedFormBySlug(db, created.form.slug)).toBeNull();
    await restoreForm(db, owner.workspaceId, created.form.id);
    expect(await getPublishedFormBySlug(db, created.form.slug)).not.toBeNull();
    const listed = await listForms(db, owner.workspaceId);
    expect(listed[0]?.publication).toBe("live");
  });

  it("marks unpublished draft changes on a live form", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Live", source: "blank" });
    await publishForm(db, { workspaceId: owner.workspaceId, formId: created.form.id, userId: owner.userId });
    await updateDraft(db, {
      workspaceId: owner.workspaceId,
      formId: created.form.id,
      expectedRevision: 1,
      schema: { ...created.draft.schema, title: "Edited" },
    });
    const listed = await listForms(db, owner.workspaceId);
    expect(listed[0]?.publication).toBe("changes");
    expect(listed[0]?.canDelete).toBe(false);
    expect(await listForms(db, owner.workspaceId, "archived")).toHaveLength(0);
  });

  it("deletes an unused draft", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Scratch", source: "blank" });
    await deleteForm(db, owner.workspaceId, created.form.id);
    const rows = await db.select().from(form).where(eq(form.id, created.form.id));
    expect(rows).toHaveLength(0);
  });

  it("keeps slugs unique", async () => {
    const owner = await seedWorkspace(db, "a");
    const first = await createForm(db, { workspaceId: owner.workspaceId, name: "Same Name", source: "blank" });
    const second = await createForm(db, { workspaceId: owner.workspaceId, name: "Same Name", source: "blank" });
    expect(first.form.slug).not.toBe(second.form.slug);
  });

  it("round-trips persisted schema JSON", async () => {
    const owner = await seedWorkspace(db, "a");
    const created = await createForm(db, { workspaceId: owner.workspaceId, name: "Blank", source: "blank" });
    const parsed = JSON.parse(JSON.stringify(created.draft.schema));
    expect(parsed.sections).toHaveLength(createBlankOnboardingSchema().sections.length);
  });
});
