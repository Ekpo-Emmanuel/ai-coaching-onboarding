"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markReviewedAction } from "@/lib/clients/actions";

export function MarkReviewedButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div><button type="button" className="button button-primary" disabled={busy} onClick={async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { const result = await markReviewedAction(submissionId); if ("error" in result) setError(result.error || "Could not mark this reviewed."); else router.refresh(); }
    catch { setError("Could not mark this reviewed. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }}>{busy ? "Saving…" : "Mark reviewed"}</button>{error ? <p role="alert" className="mt-2 text-sm text-warn">{error}</p> : null}</div>;
}
