"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ menuItem = false, className = "account-signout" }: { menuItem?: boolean; className?: string }) {
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      router.push("/login"); router.refresh();
    } catch { setError("Could not sign out. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><button type="button" role={menuItem ? "menuitem" : undefined} disabled={busy} onClick={signOut} className={className}>{busy ? "Signing out…" : "Sign out"}</button>{error ? <p className="text-sm text-warn p-2" role="alert">{error}</p> : null}</>;
}
