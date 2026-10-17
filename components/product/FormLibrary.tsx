"use client";

import Link from "next/link";
import { DotsThree } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Modal } from "./Modal";
import { StatusBadge } from "./ui";
import {
  archiveFormAction,
  deleteFormAction,
  duplicateFormAction,
  publishFormAction,
  renameFormAction,
  restoreFormAction,
} from "@/lib/forms/actions";
import type { FormListItem } from "@/lib/forms/service";

const date = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const badgeStatus = {
  draft: "draft",
  live: "published",
  changes: "changes",
  archived: "archived",
} as const;

type Dialog =
  | { kind: "more" | "rename" | "publish" | "archive" | "delete"; form: FormListItem }
  | null;

export function FormLibrary({ rows }: { rows: FormListItem[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyFallback, setCopyFallback] = useState("");
  const actionLock = useRef(false);

  function close() {
    if (busy) return;
    setDialog(null);
    setFailure("");
  }

  function openMore(row: FormListItem) {
    setCopyFallback("");
    setFailure("");
    setName(row.name);
    setDialog({ kind: "more", form: row });
  }

  async function run(task: () => Promise<{ ok?: true; error?: string } | void>, done: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setFailure("");
    setNotice("");
    try {
      const result = await task();
      if (result && "error" in result && result.error) {
        setFailure(result.error);
        return;
      }
      setDialog(null);
      setNotice(done);
      router.refresh();
    } catch {
      setFailure("Could not complete that action. Please try again.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function copyLink(row: FormListItem) {
    const url = `${window.location.origin}/f/${row.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFallback("");
      setFailure("");
      setNotice("Link copied.");
      if (dialog?.kind === "more") setDialog(null);
    } catch {
      setNotice("");
      setFailure("Clipboard unavailable. Select and copy the public link below.");
      setCopyFallback(url);
    }
  }

  const current = dialog?.form;

  return (
    <>
      <p className="form-notice" role="status">
        {notice}
      </p>
      {failure && !dialog ? <p className="form-menu-error" role="alert">{failure}</p> : null}
      {copyFallback ? <label className="block mb-4 text-sm">Public link<input className="mt-2 w-full border border-line px-3 py-2" readOnly value={copyFallback} onFocus={event => event.target.select()} /></label> : null}
      <ul className="data-list">
        {rows.map((row) => {
          const live = row.status === "published";
          const needsPublish = row.publication === "draft" || row.publication === "changes";
          return (
            <li key={row.id} className="form-manage-row">
              <div className="form-manage-main">
                <Link href={`/forms/${row.id}/build`}>{row.name}</Link>
                <small>
                  {row.versionNumber ? `Version ${row.versionNumber} · ` : ""}
                  Updated {date(row.updatedAt)}
                </small>
                <StatusBadge status={badgeStatus[row.publication]} />
              </div>
              <div className="form-manage-actions">
                {needsPublish ? (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setFailure("");
                      setDialog({ kind: "publish", form: row });
                    }}
                  >
                    Publish
                  </button>
                ) : null}
                {row.status === "archived" ? (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => run(() => restoreFormAction(row.id), "Restored.")}
                  >
                    Restore
                  </button>
                ) : null}
                {live && !needsPublish ? (
                  <button type="button" className="form-quiet form-copy" onClick={() => copyLink(row)}>
                    Copy link
                  </button>
                ) : null}
                <button type="button" className="form-quiet form-more" aria-haspopup="dialog" aria-label={`More actions for ${row.name}`} disabled={busy} onClick={() => openMore(row)}>
                  <DotsThree size={22} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {dialog && current ? (
        <Modal titleId="form-manage-title" onClose={close} busy={busy}>
          {dialog.kind === "more" ? (
            <div className="form-menu">
              <p className="eyebrow">Form</p>
              <h2 id="form-manage-title">{current.name}</h2>
              <StatusBadge status={badgeStatus[current.publication]} />
              <div className="form-menu-group">
                <Link href={`/forms/${current.id}/build`}>Open builder</Link>
                {(current.publication === "draft" || current.publication === "changes") && <button type="button" onClick={() => setDialog({kind:"publish", form:current})}>Publish</button>}
                <Link href={`/forms/${current.id}/preview`}>Preview</Link>
                <Link href={`/forms/${current.id}/submissions`}>View responses</Link>
                {current.status === "published" ? (
                  <button type="button" onClick={() => copyLink(current)}>
                    Copy public link
                  </button>
                ) : null}
              </div>
              <div className="form-menu-group">
                <button
                  type="button"
                  onClick={() => {
                    setName(current.name);
                    setDialog({ kind: "rename", form: current });
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => duplicateFormAction(current.id), "Duplicated.")}
                >
                  {busy ? "Duplicating…" : "Duplicate"}
                </button>
              </div>
              <div className="form-menu-group">
                {current.status === "archived" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => restoreFormAction(current.id), "Restored.")}
                  >
                    {busy ? "Restoring…" : "Restore"}
                  </button>
                ) : (
                  <button type="button" onClick={() => setDialog({ kind: "archive", form: current })}>
                    Archive
                  </button>
                )}
                {current.canDelete ? (
                  <button type="button" className="form-menu-danger" onClick={() => setDialog({ kind: "delete", form: current })}>
                    Delete
                  </button>
                ) : (
                  <p className="form-menu-note">This form has published versions or responses. Archive it to keep that history.</p>
                )}
              </div>
              {failure ? <p className="form-menu-error" role="alert">{failure}</p> : null}{copyFallback ? <label>Public link<input readOnly value={copyFallback} onFocus={event => event.target.select()} /></label> : null}
            </div>
          ) : null}
          {dialog.kind === "rename" ? (
            <form
              className="form-menu"
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => renameFormAction(current.id, name), "Renamed.");
              }}
            >
              <h2 id="form-manage-title">Rename form</h2>
              <label>
                Form name
                <input value={name} autoFocus onChange={(event) => setName(event.target.value)} />
              </label>
              <p className="form-menu-note">The public link stays the same.</p>
              {failure ? <p className="form-menu-error" role="alert">{failure}</p> : null}
              <div className="form-menu-actions">
                <button type="button" className="button" onClick={close}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={busy || name.trim().length < 2}>
                  {busy ? "Saving…" : "Save name"}
                </button>
              </div>
            </form>
          ) : null}
          {dialog.kind === "publish" ? (
            <div className="form-menu">
              <h2 id="form-manage-title">Publish {current.name}?</h2>
              <p>Publishing makes these questions available at your client link. Earlier submissions keep their original questions.</p>
              {failure ? <p className="form-menu-error" role="alert">{failure}</p> : null}
              <div className="form-menu-actions">
                <button type="button" className="button" onClick={close}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => run(() => publishFormAction(current.id), "Published.")}
                >
                  {busy ? "Publishing…" : "Publish"}
                </button>
              </div>
            </div>
          ) : null}
          {dialog.kind === "archive" ? (
            <div className="form-menu">
              <h2 id="form-manage-title">Archive {current.name}?</h2>
              <p>The public link stops working. Submissions and published versions stay. You can restore it later.</p>
              {failure ? <p className="form-menu-error" role="alert">{failure}</p> : null}
              <div className="form-menu-actions">
                <button type="button" className="button" onClick={close}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => run(() => archiveFormAction(current.id), "Archived.")}
                >
                  {busy ? "Archiving…" : "Archive"}
                </button>
              </div>
            </div>
          ) : null}
          {dialog.kind === "delete" ? (
            <div className="form-menu">
              <h2 id="form-manage-title">Delete {current.name}?</h2>
              <p>This unused draft will be removed. This cannot be undone.</p>
              {failure ? <p className="form-menu-error" role="alert">{failure}</p> : null}
              <div className="form-menu-actions">
                <button type="button" className="button" onClick={close}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  disabled={busy}
                  onClick={() => run(() => deleteFormAction(current.id), "Deleted.")}
                >
                  {busy ? "Deleting…" : "Delete draft"}
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
