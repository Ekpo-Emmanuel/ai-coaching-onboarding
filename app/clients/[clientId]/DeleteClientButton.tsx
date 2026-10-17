"use client";

import { Modal } from "@/components/product/Modal";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);

  async function onDelete() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
    const response = await fetch(`/api/clients/${clientId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; notice?: string } | null;
    setBusy(false);
    if (!response.ok) {
      setError(payload?.error || "Could not delete.");
      return;
    }
    router.push("/clients");
    router.refresh();
    } catch { setError("Could not confirm deletion. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <>
      <button type="button" className="quiet-action danger-text" onClick={() => { setConfirm(""); setError(""); setOpen(true); }}>
        Delete client data
      </button>
      {open ? (
        <Modal busy={busy} titleId="delete-client-title" onClose={() => !busy && setOpen(false)}>
            <h2 id="delete-client-title" className="font-display text-2xl tracking-tight">
              Delete {name}?
            </h2>
            <p className="mt-3 text-sm text-muted">
              This removes the client, submissions, review flags, Coach Briefs, and integration delivery snapshots stored here.
              Form versions stay. Copies previously sent to connected external destinations, such as Google Sheets or webhooks,
              may need to be removed there separately.
            </p>
            <label className="mt-4 block">
              Type DELETE to confirm
              <input
                className="mt-1 w-full rounded-2xl border border-line px-4 py-3"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            {error ? (
              <p className="mt-2 text-sm text-warn" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex gap-3">
              <button type="button" className="rounded-full border border-line px-4 py-2" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={busy || confirm !== "DELETE"}
                onClick={() => void onDelete()}
              >
                {busy ? "Deleting…" : "Delete client data"}
              </button>
            </div>
        </Modal>
      ) : null}
    </>
  );
}
