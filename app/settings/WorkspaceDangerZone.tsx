"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/product/Modal";

export function WorkspaceDangerZone() {
  const router = useRouter();
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function onDelete() {
    if (lock.current || confirm !== "DELETE") return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/workspace", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setError(payload?.error || "Could not delete workspace."); return; }
      router.push("/login"); router.refresh();
    } catch { setError("Could not confirm deletion. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="settings-data"><h2>Delete workspace</h2><p>Permanently remove this workspace and its client data. Available to the workspace owner.</p><button className="quiet-action danger-text" type="button" onClick={() => { setConfirm(""); setError(""); setOpen(true); }}>Delete workspace</button>
    {open ? <Modal titleId="delete-workspace-title" busy={busy} onClose={() => setOpen(false)}><h2 id="delete-workspace-title" className="font-display text-2xl">Delete this workspace?</h2><p className="connection-note">This permanently removes forms, clients, submissions, Agent history, and connection credentials. Your login account stays. Copies already sent to Google Sheets or webhooks must be removed there separately.</p><label className="block mt-4 text-sm">Type DELETE to confirm<input className="mt-2 w-full border border-line px-4 py-3" value={confirm} disabled={busy} onChange={event => setConfirm(event.target.value)} /></label>{error ? <p role="alert" className="connection-feedback feedback-error mt-4">{error}</p> : null}<div className="dialog-actions"><button type="button" className="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button type="button" className="button button-danger" disabled={busy || confirm !== "DELETE"} onClick={() => void onDelete()}>{busy ? "Deleting…" : "Delete workspace"}</button></div></Modal> : null}
  </section>;
}
