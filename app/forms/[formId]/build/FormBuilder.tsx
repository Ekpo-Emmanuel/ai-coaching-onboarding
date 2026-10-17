"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  DotsThreeVertical,
  Plus,
  Check,
  CircleNotch,
} from "@phosphor-icons/react";
import { FormPreview } from "@/app/forms/[formId]/preview/FormPreview";
import { archiveFormAction, publishFormAction } from "@/lib/forms/actions";
import { formSnapshotFingerprint } from "@/lib/forms/fingerprint";
import {
  addField,
  addSection,
  deleteField,
  deleteSection,
  duplicateField,
  FIELD_TYPES,
  moveField,
  moveSection,
  updateField,
  updateSection,
} from "@/lib/forms/schema-ops";
import { allFields } from "@/lib/onboarding/schema/visibility";
import { EMPTY_REVIEW_RULES, type ReviewRuleSet } from "@/lib/review/types";
import type { ClientIdentityMapping } from "@/lib/forms/identity";
import type {
  FieldType,
  FormField,
  OnboardingSchema,
} from "@/lib/onboarding/schema/types";
import { Modal } from "@/components/product/Modal";
import { Sheet } from "@/components/product/Sheet";
import {
  AgentPanel,
  type AgentChangeSetView,
  type AgentChatMessage,
} from "./AgentPanel";
import { ReviewRulesEditor } from "./ReviewRulesEditor";
import { QuestionEditor, TYPE_LABELS } from "./QuestionEditor";
import { SectionInspector } from "./SectionInspector";
import { SectionOutline } from "./SectionOutline";
import { FormSettings } from "./FormSettings";
import { useBuilderDraft } from "./useBuilderDraft";
import "./builder.css";
import "./builder-shell.css";

type Selection =
  | { kind: "overview" | "settings" | "rules" }
  | { kind: "section" | "field"; id: string };
type VersionSummary = {
  id: string;
  versionNumber: number;
  publishedAt: string;
};
export function FormBuilder({
  formId,
  formName,
  slug,
  status,
  activeVersionNumber,
  initialSchema,
  initialRevision,
  initialIdentity,
  initialReviewRules,
  versions,
  branding,
  initialMessages,
  initialChangeSets,
  initialPublishedSnapshot,
}: {
  formId: string;
  formName: string;
  slug: string;
  status: string;
  activeVersionNumber: number | null;
  initialSchema: OnboardingSchema;
  initialRevision: number;
  initialIdentity: ClientIdentityMapping | null;
  initialReviewRules: ReviewRuleSet | null;
  versions: VersionSummary[];
  branding: {
    businessName: string;
    coachName: string;
    primaryColor: string | null;
  };
  initialMessages: AgentChatMessage[];
  initialChangeSets: AgentChangeSetView[];
  initialPublishedSnapshot?: {
    schema: OnboardingSchema;
    identity: ClientIdentityMapping | null;
    reviewRules: ReviewRuleSet | null;
  } | null;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const {
    draft,
    queue,
    edit,
    flush,
    recovered,
    downloadRecovery,
    discardRecovery,
  } = useBuilderDraft(
    formId,
    {
      name: formName,
      schema: initialSchema,
      identity: initialIdentity,
      reviewRules: initialReviewRules ?? EMPTY_REVIEW_RULES,
    },
    initialRevision,
  );
  const { schema } = draft;
  const [mode, setMode] = useState<"agent" | "build" | "preview">(
    search.get("agent") === "1" ? "agent" : "build",
  );
  const [selection, setSelection] = useState<Selection>({ kind: "overview" });
  const [dialog, setDialog] = useState<
    "section" | "question" | "publish" | "delete" | "reload" | "archive" | null
  >(null);
  const [addTo, setAddTo] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newIntro, setNewIntro] = useState("");
  const [newType, setNewType] = useState<FieldType>("short_text");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [published, setPublished] = useState(activeVersionNumber);
  const [publishedFingerprint, setPublishedFingerprint] = useState<
    string | null
  >(initialPublishedSnapshot ? fingerprint(initialPublishedSnapshot) : null);
  const root = useRef<HTMLElement>(null);
  const inspector = useRef<HTMLDivElement>(null);
  const selectedField =
    selection.kind === "field"
      ? allFields(schema).find((field) => field.id === selection.id)
      : undefined;
  const selectedSection =
    selection.kind === "section"
      ? schema.sections.find((section) => section.id === selection.id)
      : undefined;
  const fieldSection = selectedField
    ? schema.sections.find((section) =>
        section.fields.some((field) => field.id === selectedField.id),
      )
    : undefined;
  const fieldsCount = allFields(schema).length;
  const unpublished = publishedFingerprint
    ? publishedFingerprint !== fingerprint(draft)
    : Boolean(published);
  const locked = busy || agentBusy;
  useEffect(() => {
    const viewport = window.visualViewport;
    const size = () => {
      if (viewport && viewport.scale === 1)
        root.current?.style.setProperty(
          "--builder-viewport",
          viewport.height + "px",
        );
    };
    size();
    viewport?.addEventListener("resize", size);
    return () => viewport?.removeEventListener("resize", size);
  }, []);
  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    }
    const itemsInMenu = () =>
      Array.from(
        moreRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not(:disabled)',
        ) ?? [],
      ).filter((item) => item.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => itemsInMenu()[0]?.focus());
    function onKey(event: KeyboardEvent) {
      const items = itemsInMenu();
      if (event.key === "Escape") {
        event.preventDefault();
        setMoreOpen(false);
        moreRef.current
          ?.querySelector<HTMLButtonElement>(".bw-publish-more")
          ?.focus();
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLElement);
        items[
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                items.length
        ]?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);
  function choose(next: Selection) {
    setSelection(next);
    setFailure("");
    requestAnimationFrame(() => {
      inspector.current?.scrollTo({ top: 0 });
      inspector.current?.querySelector<HTMLElement>("h2")?.focus();
    });
  }
  function change(next: OnboardingSchema) {
    edit({ ...queue.value, schema: next });
    setFailure("");
  }
  function mutate(operation: (value: OnboardingSchema) => OnboardingSchema) {
    try {
      change(operation(queue.value.schema));
      return true;
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Could not change the draft.",
      );
      return false;
    }
  }
  function changeField(patch: Partial<FormField> & { type?: FieldType }) {
    if (!selectedField) return;
    if (patch.type && patch.type !== selectedField.type) {
      mutate((value) => {
        const next = updateField(value, selectedField.id, patch);
        return {
          ...next,
          sections: next.sections.map((section) => ({
            ...section,
            fields: section.fields.map((field) =>
              field.id === selectedField.id
                ? {
                    ...field,
                    required: selectedField.required,
                    description: selectedField.description,
                    logic: selectedField.logic,
                  }
                : field,
            ),
          })),
        };
      });
      return;
    }
    change({
      ...schema,
      sections: schema.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.id === selectedField.id
            ? ({ ...field, ...patch } as FormField)
            : field,
        ),
      })),
    });
  }
  function openAdd(kind: "section" | "question", sectionId = "") {
    setNewTitle("");
    setNewIntro("");
    setNewType("short_text");
    setAddTo(sectionId);
    setDialog(kind);
  }
  function add() {
    if (!newTitle.trim()) return;
    try {
      if (dialog === "section") {
        let next = addSection(schema, newTitle.trim());
        const sectionId = next.sections.at(-1)!.id;
        const intro = newIntro.trim();
        if (intro)
          next = updateSection(next, sectionId, { description: intro });
        change(next);
        setDialog(null);
        setMode("build");
        choose({ kind: "section", id: sectionId });
        return;
      }
      const next = addField(schema, addTo, newType, newTitle.trim());
      change(next);
      setDialog(null);
      setMode("build");
      choose({
        kind: "field",
        id: next.sections
          .find((section) => section.id === addTo)!
          .fields.at(-1)!.id,
      });
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Could not add this question.",
      );
    }
  }
  async function publish() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setFailure("");
    try {
      await flush();
      const result = await publishFormAction(formId);
      if (!("ok" in result && result.ok))
        throw new Error(
          "error" in result ? result.error : "Could not publish.",
        );
      setPublished(result.versionNumber);
      setPublishedFingerprint(fingerprint(queue.value));
      setDialog(null);
      setNotice("Published. Your client link now shows this onboarding.");
      router.refresh();
    } catch (error) {
      setDialog(null);
      setFailure(
        error instanceof Error
          ? error.message
          : "Could not publish. Your draft is still here.",
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function archive() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await flush();
      const result = await archiveFormAction(formId);
      if (!("ok" in result && result.ok))
        throw new Error("Could not archive this form.");
      router.push("/forms");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Could not archive.");
      setDialog(null);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  function remove() {
    if (
      selectedField &&
      mutate((value) => deleteField(value, selectedField.id))
    ) {
      choose(
        fieldSection
          ? { kind: "section", id: fieldSection.id }
          : { kind: "overview" },
      );
      setDialog(null);
    } else if (
      selectedSection &&
      mutate((value) => deleteSection(value, selectedSection.id))
    ) {
      choose({ kind: "overview" });
      setDialog(null);
    }
  }
  function switchMode(next: typeof mode) {
    setMoreOpen(false);
    setMode(next);
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(
          next === "agent"
            ? ".bw-agent h2"
            : next === "build"
              ? ".bw-build h2"
              : ".bw-preview h2",
        )
        ?.focus(),
    );
  }
  function openTool(kind: "rules" | "settings") {
    setMoreOpen(false);
    setMode("build");
    choose({ kind });
  }
  function goBack() {
    if (selection.kind === "field" && fieldSection)
      choose({ kind: "section", id: fieldSection.id });
    else choose({ kind: "overview" });
  }
  const saveLabel = {
    saved: "Saved",
    unsaved: "Unsaved changes",
    saving: "Saving…",
    error: "Not saved",
    conflict: "Draft conflict",
  }[queue.state];
  const publicationLabel = published
    ? unpublished
      ? "Published · Unpublished changes"
      : "Published · Up to date"
    : "Draft · Not published";
  return (
    <main
      className="bw-workspace"
      data-mode={mode}
      data-task={selection.kind === "overview" ? "root" : "focus"}
      ref={root}
    >
      <header className="bw-header">
        {selection.kind === "section" || selection.kind === "field" ? (
          <button
            type="button"
            className="bw-exit bw-exit-crumb"
            onClick={goBack}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span>
              {selection.kind === "field"
                ? fieldSection?.title || "Section"
                : "Sections"}
            </span>
          </button>
        ) : null}
        <Link
          className={
            selection.kind === "section" || selection.kind === "field"
              ? "bw-exit bw-exit-forms"
              : "bw-exit"
          }
          aria-label="Back to Forms"
          href="/forms"
          onClick={(event) => {
            if (queue.dirty) {
              event.preventDefault();
              void flush()
                .then(() => router.push("/forms"))
                .catch(() =>
                  setFailure(
                    "Your edits haven’t saved. Retry before leaving, or download a recovery copy.",
                  ),
                );
            }
          }}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Forms</span>
        </Link>
        <div className="bw-form-status">
          <h1
            className="bw-form-name"
            title={draft.name || "Untitled onboarding"}
          >
            {draft.name || "Untitled onboarding"}
          </h1>
          {hydrated && unpublished ? (
            <span className="bw-unpublished" title="Unpublished changes">
              <span className="sr-only">Unpublished changes</span>
            </span>
          ) : null}
        </div>
        <label className="bw-mode-select">
          <span className="sr-only">Workspace mode</span>
          <select
            value={mode}
            onChange={(event) => switchMode(event.target.value as typeof mode)}
          >
            <option value="agent">Agent</option>
            <option value="build">Build</option>
            <option value="preview">Preview</option>
          </select>
        </label>
        <nav className="bw-modes" aria-label="Workspace modes">
          {(["agent", "build", "preview"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => switchMode(value)}
            >
              {value === "agent"
                ? "Agent"
                : value === "build"
                  ? "Build"
                  : "Preview"}
            </button>
          ))}
        </nav>
        <div className="bw-header-actions">
          <span className="bw-save" data-state={queue.state} role="status">
            {queue.state === "saving" ? (
              <CircleNotch className="bw-spinner" size={15} />
            ) : queue.state === "saved" ? (
              <Check size={15} />
            ) : null}
            <span>{saveLabel}</span>
          </span>
          <div
            className="bw-publish-split"
            ref={moreRef}
            onBlur={(event) => {
              if (
                event.relatedTarget &&
                !event.currentTarget.contains(event.relatedTarget as Node)
              )
                setMoreOpen(false);
            }}
          >
            <button
              type="button"
              className="button button-primary bw-publish"
              disabled={locked || queue.state === "conflict"}
              onClick={() => setDialog("publish")}
            >
              Publish
            </button>
            <button
              type="button"
              className="button button-primary bw-publish-more"
              aria-label="Form tools"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <DotsThreeVertical size={18} weight="bold" />
            </button>
            {moreOpen ? (
              <div className="bw-more-menu" role="menu" aria-label="Form tools">
                <p className="bw-tools-status">
                  <strong>{draft.name || "Untitled onboarding"}</strong>
                  {saveLabel}
                  <br />
                  {publicationLabel}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  className="bw-menu-publish"
                  disabled={locked || queue.state === "conflict"}
                  onClick={() => {
                    moreRef.current
                      ?.querySelector<HTMLButtonElement>(".bw-publish")
                      ?.focus();
                    setMoreOpen(false);
                    setDialog("publish");
                  }}
                >
                  Publish
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="bw-menu-mode"
                  onClick={() => {
                    setMoreOpen(false);
                    switchMode("agent");
                  }}
                >
                  Agent
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="bw-menu-mode"
                  onClick={() => {
                    setMoreOpen(false);
                    switchMode("preview");
                  }}
                >
                  Preview
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openTool("rules")}
                >
                  Review rules
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openTool("settings")}
                >
                  Form settings
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {failure || queue.error ? (
        <div className="bw-banner bw-banner-error" role="alert">
          <p>
            {failure || queue.error}
            {queue.state === "conflict"
              ? " Your edits are kept on this device. Review or download them before loading the saved draft."
              : " Your edits are still here."}
          </p>
          <div>
            {queue.state === "error" || queue.state === "unsaved" ? (
              <button
                type="button"
                onClick={() => void flush().catch(() => undefined)}
              >
                Retry save
              </button>
            ) : null}
            {queue.dirty ? (
              <button type="button" onClick={downloadRecovery}>
                Download my edits
              </button>
            ) : null}
            {queue.state === "conflict" ? (
              <button type="button" onClick={() => setDialog("reload")}>
                Load saved draft
              </button>
            ) : (
              <button type="button" onClick={() => setFailure("")}>
                Dismiss
              </button>
            )}
          </div>
        </div>
      ) : notice ? (
        <div className="bw-banner" role="status">
          <p>{notice}</p>
          <button type="button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      ) : recovered && queue.dirty ? (
        <div className="bw-banner" role="status">
          Your unsaved edits were recovered on this device. Review them, then{" "}
          <button
            type="button"
            onClick={() => void flush().catch(() => undefined)}
          >
            Save recovered edits
          </button>
          .
        </div>
      ) : null}
      <div className="bw-panes" data-mode={mode}>
        <div className="bw-agent">
          <AgentPanel
            formId={formId}
            initialMessages={initialMessages}
            initialChangeSets={initialChangeSets}
            currentRevision={queue.revision}
            schema={schema}
            reviewRules={draft.reviewRules}
            disabled={busy}
            branding={branding}
            onFlushSave={flush}
            onApplying={setAgentBusy}
            docked={mode === "build"}
            onOpenBuilder={() => switchMode("build")}
            onApplied={(next) => {
              queue.replace(
                {
                  name: next.formName ?? queue.value.name,
                  schema: next.schema,
                  identity: next.clientIdentityMapping,
                  reviewRules: next.reviewRules ?? queue.value.reviewRules,
                },
                next.revision,
              );
              setNotice(
                "Changes applied to your draft. Preview before publishing.",
              );
              choose({ kind: "overview" });
              switchMode("build");
            }}
          />
        </div>
        <div className="bw-build" ref={inspector}>
          <fieldset disabled={locked} className="bw-editor-fieldset">
            {selection.kind !== "overview" && (
              <div
                className={
                  selection.kind === "section" || selection.kind === "field"
                    ? "bw-build-toolbar bw-section-back"
                    : "bw-build-toolbar"
                }
              >
                <button type="button" className="bw-back" onClick={goBack}>
                  <ArrowLeft size={16} />
                  {selection.kind === "field"
                    ? fieldSection?.title || "Section"
                    : "All sections"}
                </button>
              </div>
            )}
            {selection.kind === "overview" ? (
              <div className="bw-overview">
                <div className="bw-section-heading">
                  <div>
                    <p className="eyebrow">
                      {schema.sections.length}{" "}
                      {schema.sections.length === 1 ? "section" : "sections"} ·{" "}
                      {fieldsCount}{" "}
                      {fieldsCount === 1 ? "question" : "questions"}
                    </p>
                    <h2 tabIndex={-1}>Form structure</h2>
                  </div>
                  <button
                    type="button"
                    className="bw-add-section"
                    onClick={() => openAdd("section")}
                  >
                    <Plus size={16} />
                    Add section
                  </button>
                </div>
                {!fieldsCount ? (
                  <div className="bw-empty">
                    <h3>Start with your client’s story.</h3>
                    <p>
                      Describe what you need to the Agent, or add your first
                      question below.
                    </p>
                    <button
                      type="button"
                      className="bw-secondary"
                      onClick={() => switchMode("agent")}
                    >
                      Ask the Agent
                    </button>
                  </div>
                ) : null}
                <div className="bw-section-list">
                  {schema.sections.map((section, index) => (
                    <SectionOutline
                      key={section.id}
                      section={section}
                      index={index}
                      onOpen={() => choose({ kind: "section", id: section.id })}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {selectedSection ? (
              <SectionInspector
                section={selectedSection}
                schema={schema}
                onOpenQuestion={(id) => choose({ kind: "field", id })}
                onAddQuestion={() => openAdd("question", selectedSection.id)}
                onRename={(title) =>
                  change({
                    ...schema,
                    sections: schema.sections.map((section) =>
                      section.id === selectedSection.id
                        ? { ...section, title, navLabel: title }
                        : section,
                    ),
                  })
                }
                onIntro={(description) =>
                  change({
                    ...schema,
                    sections: schema.sections.map((section) =>
                      section.id === selectedSection.id
                        ? { ...section, description }
                        : section,
                    ),
                  })
                }
                onMove={(direction) =>
                  mutate((value) =>
                    moveSection(value, selectedSection.id, direction),
                  )
                }
                onDelete={() => setDialog("delete")}
              />
            ) : null}
            {selectedField ? (
              <div className="bw-inspector">
                <h2 tabIndex={-1}>Edit question</h2>
                <QuestionEditor
                  key={selectedField.id}
                  field={selectedField}
                  schema={schema}
                  onChange={changeField}
                  reviewRules={draft.reviewRules}
                  onRulesChange={(nextRules) =>
                    edit({ ...queue.value, reviewRules: nextRules })
                  }
                  onDelete={() => setDialog("delete")}
                />
              </div>
            ) : null}
            {selection.kind === "rules" ? (
              <div className="bw-inspector">
                <ReviewRulesEditor
                  schema={schema}
                  rules={draft.reviewRules}
                  onChange={(reviewRules) =>
                    edit({ ...queue.value, reviewRules })
                  }
                />
              </div>
            ) : null}
            {selection.kind === "settings" ? (
              <div className="bw-inspector">
                <h2 tabIndex={-1}>Form settings</h2>
                <FormSettings draft={draft} onChange={edit} />
                <details className="bw-disclosure">
                  <summary>Published versions and client link</summary>
                  <div>
                    {published ? (
                      <>
                        <p className="bw-note">
                          Your published onboarding stays live while you edit.
                        </p>
                        <button
                          type="button"
                          className="bw-secondary"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(window.location.origin + "/f/" + slug)
                              .then(() => setNotice("Client link copied."))
                              .catch(() =>
                                setFailure(
                                  "Could not copy. Open the client link and copy it from your browser.",
                                ),
                              )
                          }
                        >
                          Copy client link
                        </button>
                        <Link href={"/f/" + slug} target="_blank">
                          Open client link
                        </Link>
                      </>
                    ) : (
                      <p className="bw-note">
                        Publish before sharing a client link.
                      </p>
                    )}
                    <ul>
                      {versions.map((version) => (
                        <li key={version.id}>
                          Version {version.versionNumber} ·{" "}
                          {new Date(version.publishedAt).toLocaleDateString()}
                        </li>
                      ))}
                    </ul>
                    <Link href={"/forms/" + formId + "/submissions"}>
                      View responses
                    </Link>
                  </div>
                </details>
                <button
                  type="button"
                  className="bw-text-danger"
                  disabled={status === "archived"}
                  onClick={() => setDialog("archive")}
                >
                  Archive form
                </button>
              </div>
            ) : null}
          </fieldset>
        </div>
        <div className="bw-preview">
          <div className="bw-preview-bar">
            <h2 tabIndex={-1}>Preview</h2>
            <p>Nothing is submitted.</p>
          </div>
          {mode === "preview" ? (
            <FormPreview schema={schema} branding={branding} compact />
          ) : null}
        </div>
      </div>
      {dialog === "section" ? (
        <Sheet
          titleId="builder-dialog-title"
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <div className="bw-dialog">
            <form
              className="bw-section-form"
              onSubmit={(event) => {
                event.preventDefault();
                add();
              }}
            >
              <p className="eyebrow">Form structure</p>
              <h2 id="builder-dialog-title">Add new section</h2>
              <label>
                <span className="bw-field-caption">
                  Section title{" "}
                  <span className="bw-required" aria-hidden="true">
                    *
                  </span>
                </span>
                <input
                  value={newTitle}
                  autoFocus
                  required
                  aria-required="true"
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="e.g. Training experience"
                />
              </label>
              <label>
                <span className="bw-field-caption">
                  Section introduction{" "}
                  <span className="bw-optional">(optional)</span>
                </span>
                <span className="bw-field-hint">
                  Shown at the top of this section so the client knows what to
                  expect.
                </span>
                <textarea
                  rows={4}
                  value={newIntro}
                  onChange={(event) => setNewIntro(event.target.value)}
                  placeholder="e.g. A short snapshot of training history and how often they train."
                />
              </label>
              <div className="bw-dialog-actions">
                <button
                  type="submit"
                  className="bw-primary"
                  disabled={!newTitle.trim()}
                >
                  <Plus size={16} aria-hidden="true" />
                  Add section
                </button>
              </div>
            </form>
            {failure ? (
              <p className="bw-inline-error" role="alert">
                {failure}
              </p>
            ) : null}
          </div>
        </Sheet>
      ) : dialog ? (
        <Modal
          busy={busy}
          titleId="builder-dialog-title"
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <div className="bw-dialog">
            <p className="eyebrow">
              {dialog === "question" ? "New question" : "Your onboarding"}
            </p>
            <h2 id="builder-dialog-title">
              {dialog === "question"
                ? "What would you like to ask?"
                : dialog === "publish"
                  ? published
                    ? "Publish your changes?"
                    : "Ready for your clients?"
                  : dialog === "reload"
                    ? "Load the saved draft?"
                    : dialog === "archive"
                      ? "Archive this form?"
                      : "Remove " +
                        (selectedField
                          ? `“${selectedField.label.trim() || "this question"}”?`
                          : "this section?")}
            </h2>
            {dialog === "question" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  add();
                }}
              >
                <label>
                  Answer type
                  <select
                    value={newType}
                    onChange={(event) =>
                      setNewType(event.target.value as FieldType)
                    }
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Question
                  <input
                    value={newTitle}
                    autoFocus
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="e.g. What is your main goal?"
                  />
                </label>
                <p className="bw-note">
                  You can refine the details after adding it.
                </p>
                <div className="bw-dialog-actions">
                  <button
                    type="button"
                    className="bw-secondary"
                    onClick={() => setDialog(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bw-primary"
                    disabled={!newTitle.trim()}
                  >
                    Add question
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p>
                  {dialog === "publish"
                    ? published
                      ? "Your current client link will show this draft. Earlier submissions keep their original questions."
                      : "We’ll save your draft and check it before making your onboarding available to clients."
                    : dialog === "reload"
                      ? "This replaces your local edits with the saved draft. Download your edits first if you need to keep them."
                      : dialog === "archive"
                        ? "Clients will no longer be able to open this form. Existing submissions remain stored."
                        : selectedField
                          ? "This removes the question from your draft. Published versions and existing responses stay unchanged."
                          : "All questions in this section will be removed from your draft. Published versions remain unchanged."}
                </p>
                {dialog === "publish" ? (
                  <div className="bw-publish-summary">
                    <span>{schema.sections.length} sections</span>
                    <span>{fieldsCount} questions</span>
                    <span>
                      {draft.reviewRules?.rules.length ?? 0} review rules
                    </span>
                  </div>
                ) : null}
                {dialog === "reload" ? (
                  <button
                    type="button"
                    className="bw-secondary"
                    onClick={downloadRecovery}
                  >
                    Download my edits
                  </button>
                ) : null}
                <div className="bw-dialog-actions">
                  <button
                    type="button"
                    className="bw-secondary"
                    disabled={busy}
                    onClick={() => setDialog(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={
                      dialog === "publish" ? "bw-primary" : "bw-danger"
                    }
                    disabled={busy}
                    onClick={() =>
                      dialog === "publish"
                        ? void publish()
                        : dialog === "reload"
                          ? discardRecovery()
                          : dialog === "archive"
                            ? void archive()
                            : remove()
                    }
                  >
                    {busy
                      ? dialog === "publish"
                        ? "Publishing…"
                        : "Archiving…"
                      : dialog === "publish"
                        ? "Publish onboarding"
                        : dialog === "reload"
                          ? "Load saved draft"
                          : dialog === "archive"
                            ? "Archive form"
                            : "Remove from draft"}
                  </button>
                </div>
              </>
            )}
            {failure ? (
              <p className="bw-inline-error" role="alert">
                {failure}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

function fingerprint(value: {
  schema: OnboardingSchema;
  identity: ClientIdentityMapping | null;
  reviewRules: ReviewRuleSet | null;
}) {
  return formSnapshotFingerprint(value);
}
