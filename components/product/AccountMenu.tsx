"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { SignOutButton } from "./SignOutButton";

export function AccountMenu({
  businessName,
}: {
  businessName?: string;
}) {
  const session = authClient.useSession();
  const email = session.data?.user.email;
  const label = businessName || "Your workspace";
  const initial = label.slice(0, 1);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    });
    function onKey(event: KeyboardEvent) {
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="account-menu" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
      <button
        ref={buttonRef}
        type="button"
        className="account-trigger"
        aria-label={`Account for ${label}`}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="workspace-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="account-trigger-copy"><strong>{label}</strong><span>Account</span></span>
        <span className="account-tablet-label">Account</span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          className="account-panel"
          role="menu"
          aria-label="Account"
        >
          <p className="account-panel-id">
            <strong>{label}</strong>
            {email ? <span>{email}</span> : <span>Coach workspace</span>}
          </p>
          <Link role="menuitem" href="/settings/profile" onClick={() => setOpen(false)}>
            Coaching profile
          </Link>
          <SignOutButton menuItem />
        </div>
      ) : null}
    </div>
  );
}
