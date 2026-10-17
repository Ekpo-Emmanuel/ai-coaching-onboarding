"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  SquaresFour,
  Files,
  Users,
  PlugsConnected,
  GearSix,
  List,
  X,
} from "@phosphor-icons/react";
import { Brand } from "./Brand";
import { AccountMenu } from "./AccountMenu";
import { SignOutButton } from "./SignOutButton";
import { authClient } from "@/lib/auth-client";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { href: "/forms", label: "Forms", icon: Files },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings/connections", label: "Connections", icon: PlugsConnected },
  { href: "/settings", label: "Settings", icon: GearSix },
] as const;

export function AppShell({
  children,
  businessName,
  activePath,
}: {
  children: ReactNode;
  businessName?: string;
  activePath?: string;
}) {
  const pathname = usePathname();
  const path = activePath ?? pathname;
  const current = nav.find((item) =>
    item.href === "/settings"
      ? path === "/settings" || path.startsWith("/settings/profile")
      : path === item.href || path.startsWith(item.href + "/"),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [entered, setEntered] = useState(false);
  const [trackedPath, setTrackedPath] = useState(path);
  if (path !== trackedPath) {
    setTrackedPath(path);
    setMenuOpen(false);
  }
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const panelId = useId();
  const session = authClient.useSession();
  const workspace = businessName || "Your workspace";
  const builder = path.endsWith("/build");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (media.matches) setMenuOpen(false);
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      setDrawer(true);
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() => setEntered(true)),
      );
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduce ? 0 : 300;
    const timer = window.setTimeout(() => setDrawer(false), wait);
    return () => window.clearTimeout(timer);
  }, [menuOpen]);

  useEffect(() => {
    if (!drawer) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [drawer]);

  useEffect(() => {
    if (!menuOpen || !drawer) return;
    const panel = panelRef.current;
    const trigger = buttonRef.current;
    const closeButton = panel?.querySelector<HTMLElement>(
      "button[aria-label='Close navigation']",
    );
    closeButton?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)"),
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
    };
  }, [menuOpen, drawer]);

  return (
    <div className={`app-shell${builder ? " app-shell-builder" : ""}`}>
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      {!builder && (
        <>
          <aside className="app-sidebar">
            <Link
              className="sidebar-brand"
              href="/dashboard"
              aria-label="Coaching dashboard"
            >
              <Brand />
            </Link>
            <nav className="app-nav" aria-label="Main navigation">
              {nav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={current?.href === href ? "page" : undefined}
                >
                  <Icon size={21} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <AccountMenu businessName={businessName} />
            </div>
          </aside>
          <header className="mobile-header">
            <Link
              href="/dashboard"
              className="mobile-brand [&_.brand]:gap-1.5 [&_.brand]:text-[18px] [&_.brand]:tracking-tight max-md:[&_.brand-mark]:h-[18px] max-md:[&_.brand-mark]:w-[18px]"
              aria-label="Coaching dashboard"
            >
              <Brand />
            </Link>
            <button
              ref={buttonRef}
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-[8px] bg-transparent text-accent hover:bg-accent-soft"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls={panelId}
              aria-label={`Open navigation for ${workspace}`}
              onClick={() => setMenuOpen(true)}
            >
              <List size={22} aria-hidden="true" />
            </button>
          </header>
          {drawer && (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className={`absolute inset-0 bg-[#243B3266] transition-opacity duration-300 ease-out motion-reduce:transition-none ${entered ? "opacity-100" : "opacity-0"}`}
                onClick={() => setMenuOpen(false)}
              />
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`absolute inset-y-0 right-0 flex h-dvh w-[70%] max-w-[70%] flex-col overflow-y-auto overscroll-contain border-0 bg-paper px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(8px,env(safe-area-inset-top))] text-ink shadow-[-8px_0_24px_#243B3214] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${entered ? "translate-x-0" : "translate-x-full"}`}
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="[&_.brand]:gap-1.5 [&_.brand]:text-[18px] [&_.brand-mark]:h-[18px] [&_.brand-mark]:w-[18px]">
                    <Brand />
                  </span>
                  <button
                    type="button"
                    className="grid size-11 place-items-center border-0 bg-transparent text-muted"
                    aria-label="Close navigation"
                    onClick={() => setMenuOpen(false)}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
                <nav
                  className="navigation-destinations"
                  aria-label="Main navigation"
                >
                  {nav.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      aria-current={current?.href === href ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon size={20} aria-hidden="true" />
                      <span>{label}</span>
                      {current?.href === href && <small>Current</small>}
                    </Link>
                  ))}
                </nav>
                <div className="navigation-account">
                  <div className="navigation-identity">
                    <span className="workspace-avatar" aria-hidden="true">
                      {workspace.slice(0, 1)}
                    </span>
                    <div>
                      <h2 id={titleId}>{workspace}</h2>
                      {session.data?.user.email && (
                        <p>{session.data.user.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="navigation-account-actions">
                    <Link
                      href="/settings/profile"
                      onClick={() => setMenuOpen(false)}
                    >
                      Coaching profile
                    </Link>
                    <SignOutButton />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div className="app-workspace">
        <div id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}
