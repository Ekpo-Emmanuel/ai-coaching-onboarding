"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  CircleNotch,
  CornersIn,
  CornersOut,
  Eye,
} from "@phosphor-icons/react";
import { FormPreview } from "@/app/forms/[formId]/preview/FormPreview";
import { Modal } from "@/components/product/Modal";
import { Sheet } from "@/components/product/Sheet";
import { StatusBadge } from "@/components/product/ui";
import type { ClientIdentityMapping } from "@/lib/forms/identity";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { ReviewRuleSet } from "@/lib/review/types";
import { isDestructiveProposal, parseChangeDetails } from "./agent-changes";
import { agentNextPrompts, agentStarterPrompts } from "./agent-suggestions";
import "./builder.css";

export type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  changeSetId?: string | null;
  createdAt?: string | Date | null;
};
export type AgentChangeSetView = {
  id: string;
  status: "proposed" | "applied" | "rejected" | "superseded";
  summary: string;
  details: string[];
  baseDraftRevision: number;
};
type Applied = {
  schema: OnboardingSchema;
  clientIdentityMapping: ClientIdentityMapping | null;
  reviewRules?: ReviewRuleSet | null;
  revision: number;
  formName?: string;
};
const FAIL =
  "The Agent couldn’t complete that request. Your form has not been changed.";

function clock(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AgentPanel({
  formId,
  initialMessages,
  initialChangeSets,
  currentRevision,
  schema,
  reviewRules,
  branding = { businessName: "Coaching", coachName: "", primaryColor: null },
  autoFocus,
  disabled = false,
  docked = false,
  onFlushSave,
  onApplying,
  onOpenBuilder,
  onApplied,
}: {
  formId: string;
  initialMessages: AgentChatMessage[];
  initialChangeSets: AgentChangeSetView[];
  currentRevision?: number;
  schema?: OnboardingSchema | null;
  reviewRules?: ReviewRuleSet | null;
  branding?: {
    businessName: string;
    coachName: string;
    primaryColor: string | null;
  };
  autoFocus?: boolean;
  disabled?: boolean;
  docked?: boolean;
  onFlushSave?: () => Promise<void>;
  onApplying?: (value: boolean) => void;
  onOpenBuilder?: () => void;
  onApplied: (next: Applied) => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [sets, setSets] = useState<Record<string, AgentChangeSetView>>(
    Object.fromEntries(initialChangeSets.map((item) => [item.id, item])),
  );
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState<
    "sending" | "applying" | "rejecting" | "previewing" | null
  >(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    id: string;
    schema: OnboardingSchema;
  } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [tall, setTall] = useState(false);
  const busy = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lift = useRef({ y: 0, active: false, moved: false });
  const lastFieldH = useRef(22);
  const sending = working === "sending";
  const composingLocked = disabled || sending;
  const unavailable = Boolean(working) || disabled;
  const canSend = Boolean(draft.trim()) && !unavailable;
  const dock = docked && compact;
  const starters = useMemo(
    () => agentStarterPrompts(schema, reviewRules),
    [schema, reviewRules],
  );
  const last = messages.at(-1);
  const lastSet = last?.changeSetId ? sets[last.changeSetId] : undefined;
  const nextPrompts =
    lastSet?.status === "applied" ? agentNextPrompts(lastSet.details) : [];
  useEffect(() => {
    if (autoFocus && matchMedia("(min-width:1100px)").matches)
      input.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    const media = matchMedia("(max-width: 899px)");
    const sync = () => {
      setCompact(media.matches);
      if (!media.matches) setSheetOpen(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "instant",
    });
  }, [messages, working]);
  useEffect(() => {
    if (!draft.trim() && tall) setTall(false);
  }, [draft, tall]);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    const empty = !draft.trim();
    if (empty) {
      field.style.height = "22px";
      field.style.maxHeight = "22px";
      field.style.overflowY = "hidden";
      lastFieldH.current = 22;
      return;
    }
    const max = sheetOpen || tall ? 240 : 120;
    field.style.maxHeight = `${max}px`;
    field.style.overflowY = "hidden";
    field.style.height = "auto";
    let next = Math.min(Math.max(field.scrollHeight, 22), max);
    if (next < 40 && lastFieldH.current > next) next = Math.min(lastFieldH.current, max);
    field.style.height = `${next}px`;
    lastFieldH.current = next;
    field.style.overflowY = field.scrollHeight > max ? "auto" : "hidden";
  }, [draft, tall, sheetOpen]);
  useEffect(() => {
    if (!sheetOpen) return;
    const id = requestAnimationFrame(() => {
      const field = input.current;
      if (!field || !draft.trim()) return;
      const max = 240;
      field.style.maxHeight = `${max}px`;
      field.style.height = "auto";
      const next = Math.min(Math.max(field.scrollHeight, lastFieldH.current, 22), max);
      field.style.height = `${next}px`;
      lastFieldH.current = next;
      field.style.overflowY = field.scrollHeight > max ? "auto" : "hidden";
    });
    return () => cancelAnimationFrame(id);
  }, [sheetOpen, draft]);
  function stale(item: AgentChangeSetView) {
    return (
      item.status === "superseded" ||
      (item.status === "proposed" &&
        currentRevision !== undefined &&
        item.baseDraftRevision !== currentRevision)
    );
  }
  async function send(text = draft) {
    const message = text.trim();
    if (!message || busy.current || disabled) return;
    busy.current = true;
    setWorking("sending");
    setError("");
    if (
      docked &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 899px)").matches
    ) {
      setCompact(true);
      setSheetOpen(true);
    }
    try {
      await onFlushSave?.();
      setMessages((previous) => {
        const lastTurn = previous.at(-1);
        if (lastTurn?.role === "user" && lastTurn.content === message)
          return previous;
        return [
          ...previous,
          { id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString() },
        ];
      });
      setDraft("");
      setTall(false);
      const response = await fetch(`/api/forms/${formId}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.message)
        throw new Error(payload.error || FAIL);
      setMessages((previous) => [...previous, payload.message]);
      if (payload.changeSet)
        setSets((previous) => ({
          ...previous,
          [payload.changeSet.id]: payload.changeSet,
        }));
    } catch (reason) {
      setDraft(message);
      setError(reason instanceof Error ? reason.message : FAIL);
    } finally {
      busy.current = false;
      setWorking(null);
    }
  }
  async function decide(id: string, action: "apply" | "reject" | "preview") {
    if (busy.current || disabled) return;
    busy.current = true;
    setWorking(
      action === "apply"
        ? "applying"
        : action === "reject"
          ? "rejecting"
          : "previewing",
    );
    setError("");
    if (action === "apply") onApplying?.(true);
    try {
      if (action !== "reject") await onFlushSave?.();
      const response = await fetch(
        `/api/forms/${formId}/agent/change-sets/${id}/${action}`,
        { method: action === "preview" ? "GET" : "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409)
          setSets((previous) => ({
            ...previous,
            [id]: { ...previous[id], status: "superseded" },
          }));
        throw new Error(
          payload.error ||
            "Could not complete that action. Your draft is unchanged.",
        );
      }
      if (action === "preview") {
        if (!payload.schema)
          throw new Error(
            "This proposal preview is unavailable. Your draft is unchanged.",
          );
        setPreview({ id, schema: payload.schema });
      } else if (action === "apply") {
        if (!payload.schema || payload.revision == null)
          throw new Error(
            "Could not confirm those changes. Reload the saved draft before continuing.",
          );
        onApplied({
          schema: payload.schema,
          revision: payload.revision,
          clientIdentityMapping: payload.clientIdentityMapping ?? null,
          reviewRules: payload.reviewRules,
          formName: payload.formName,
        });
        setSets((previous) => ({
          ...previous,
          [id]: { ...previous[id], status: "applied" },
        }));
        setPreview(null);
      } else
        setSets((previous) => ({
          ...previous,
          [id]: { ...previous[id], status: "rejected" },
        }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not complete that action. Try again.",
      );
    } finally {
      busy.current = false;
      setWorking(null);
      onApplying?.(false);
    }
  }
  function openSheet() {
    if (!dock) return;
    if (input.current) lastFieldH.current = Math.max(lastFieldH.current, input.current.offsetHeight);
    setSheetOpen(true);
  }
  function onExpandClick() {
    if (input.current) lastFieldH.current = Math.max(lastFieldH.current, input.current.offsetHeight);
    if (dock) setSheetOpen((open) => !open);
    else setTall((value) => !value);
  }
  function onHandlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!dock || sheetOpen) return;
    lift.current = { y: event.clientY, active: true, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onHandlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!lift.current.active) return;
    if (lift.current.y - event.clientY > 48) {
      lift.current.active = false;
      lift.current.moved = true;
      openSheet();
    }
  }
  function onHandlePointerUp() {
    if (!lift.current.active) {
      lift.current.moved = false;
      return;
    }
    lift.current.active = false;
    if (!lift.current.moved) openSheet();
    lift.current.moved = false;
  }
  const heading = (
    <header className="bw-agent-heading">
      <span className="bw-agent-mark" aria-hidden="true">
        ✳
      </span>
      <div>
        <p className="eyebrow">Coaching Agent</p>
        <h2 id="agent-sheet-title" tabIndex={-1}>
          {messages.length ? "Ask for a change." : "Let’s build it together."}
        </h2>
      </div>
    </header>
  );
  const conversation = (
    <div
      className="bw-conversation"
      ref={scroller}
      aria-label="Agent conversation"
    >
      {!messages.length ? (
        <div className="bw-agent-welcome">
          <h3>Tell me what to change.</h3>
          <p>
            Describe the onboarding in ordinary language. I propose the edit.
            You apply it.
          </p>
          <div className="bw-suggestions">
            {starters.map((text) => (
              <button
                key={text}
                type="button"
                disabled={unavailable}
                onClick={() => void send(text)}
              >
                {text}
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          {onOpenBuilder ? (
            <button
              type="button"
              className="bw-quiet"
              onClick={() => {
                setSheetOpen(false);
                onOpenBuilder();
              }}
            >
              Or start in Build
              <ArrowRight size={16} />
            </button>
          ) : null}
        </div>
      ) : null}
      {messages.map((message) => {
        const proposal = message.changeSetId
          ? sets[message.changeSetId]
          : undefined;
        const outdated = proposal ? stale(proposal) : false;
        const pending = proposal?.status === "proposed" && !outdated;
        const state = proposal
          ? outdated
            ? "superseded"
            : proposal.status
          : undefined;
        const changes = proposal ? parseChangeDetails(proposal.details) : [];
        const destructive = proposal
          ? isDestructiveProposal(proposal.details)
          : false;
        const proposalN =
          messages
            .filter((item) => item.role === "assistant" && item.changeSetId)
            .findIndex((item) => item.id === message.id) + 1;
        const stamp = clock(message.createdAt);
        const sectionChange = changes.find((item) => item.verb === "Add section");
        const listed = changes.filter((item) => item !== sectionChange);
        return (
          <article
            className="bw-turn"
            data-role={message.role}
            key={message.id}
          >
            {stamp ? <time className="bw-turn-time" dateTime={message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt ?? undefined}>{stamp}</time> : null}
            {message.role === "user" ? (
              <p className="bw-coach">{message.content}</p>
            ) : (
              <div className="bw-agent-copy">
                {message.content ? <p>{message.content}</p> : null}
                {proposal ? (
                  <section
                    className="bw-changeset"
                    data-state={state}
                    data-kind={
                      destructive && pending ? "destructive" : undefined
                    }
                  >
                    <div className="bw-changeset-head">
                      <span className="bw-changeset-num">{String(Math.max(proposalN, 1)).padStart(2, "0")}</span>
                      <h3>
                        {pending
                          ? "Proposed Changes"
                          : state === "applied"
                            ? "Applied to draft"
                            : state === "rejected"
                              ? "Rejected"
                              : "Outdated proposal"}
                      </h3>
                      {pending ? (
                        <p className="bw-changeset-flag">Not applied</p>
                      ) : state === "superseded" ? (
                        <StatusBadge status="superseded" />
                      ) : null}
                    </div>
                    {pending ? (
                      <>
                        {sectionChange ? <p className="bw-change-heading">{sectionChange.verb}: {sectionChange.label}</p> : null}
                        <ul className="bw-change-list">
                          {(listed.length
                            ? listed
                            : sectionChange
                              ? []
                              : [
                                  {
                                    kind: "other" as const,
                                    verb: "Change",
                                    label: proposal.summary,
                                    destructive: false,
                                  },
                                ]
                          ).map((item, index) => (
                            <li key={index} data-kind={item.kind}>
                              {item.kind === "add" ? <span aria-hidden="true">+</span> : <span>{item.verb}</span>} {item.label}
                            </li>
                          ))}
                        </ul>
                        <p className="bw-note">
                          {destructive
                            ? "This removes content from your draft. Publish is still separate."
                            : "This stays a draft until you publish."}
                        </p>
                        <button
                          type="button"
                          className="bw-proposal-preview"
                          disabled={unavailable}
                          onClick={() => void decide(proposal.id, "preview")}
                        >
                          <Eye size={16} />
                          Preview proposed form
                        </button>
                        <div className="bw-proposal-actions">
                          <button
                            type="button"
                            className="bw-secondary"
                            disabled={unavailable}
                            onClick={() => void decide(proposal.id, "reject")}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="bw-primary"
                            disabled={unavailable}
                            onClick={() => void decide(proposal.id, "apply")}
                          >
                            Apply changes
                            <Check size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="bw-proposal-receipt">
                        <p>
                          {outdated
                            ? "Your draft changed after this proposal. Ask again for an updated version."
                            : proposal.status === "applied"
                              ? "In your draft. Clients see it after you publish."
                              : "Rejected. The draft was not changed."}
                        </p>
                        {outdated ? (
                          <div className="bw-actions">
                            <button
                              type="button"
                              className="bw-secondary"
                              disabled={unavailable}
                              onClick={() =>
                                void send(
                                  "Update your last proposal for the current draft.",
                                )
                              }
                            >
                              Update proposal
                            </button>
                            {proposal.status === "proposed" ? (
                              <button
                                type="button"
                                className="bw-quiet"
                                disabled={unavailable}
                                onClick={() =>
                                  void decide(proposal.id, "reject")
                                }
                              >
                                Reject
                              </button>
                            ) : null}
                          </div>
                        ) : proposal.status === "applied" &&
                          onOpenBuilder &&
                          last?.changeSetId === proposal.id ? (
                          <button
                            type="button"
                            className="bw-quiet"
                            onClick={() => {
                              setSheetOpen(false);
                              onOpenBuilder();
                            }}
                          >
                            View in Build
                            <ArrowRight size={16} />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
            )}
          </article>
        );
      })}
      {lastSet?.status === "applied" && nextPrompts.length ? (
        <div className="bw-suggestions bw-suggestions-next">
          {nextPrompts.map((text) => (
            <button
              key={text}
              type="button"
              disabled={unavailable}
              onClick={() => void send(text)}
            >
              {text}
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      ) : null}
      {working ? (
        <p className="bw-agent-working" role="status">
          <CircleNotch size={16} className="bw-spinner" />
          {working === "sending"
            ? "Working on your form…"
            : working === "applying"
              ? "Applying to your draft…"
              : working === "rejecting"
                ? "Rejecting this proposal…"
                : "Preparing the proposed form…"}
        </p>
      ) : null}
    </div>
  );
  const errorBar = error ? (
    <div className="bw-agent-error" role="alert">
      <p>{error}</p>
      <div>
        {draft.trim() ? (
          <button
            type="button"
            className="bw-quiet"
            onClick={() => void send()}
          >
            Retry
          </button>
        ) : null}
        <button type="button" className="bw-quiet" onClick={() => setError("")}>
          Dismiss
        </button>
      </div>
    </div>
  ) : null;
  const emptyDraft = !draft.trim();
  const composer = (
    <form
      className="bw-composer"
      data-busy={working || undefined}
      data-ready={canSend ? "true" : undefined}
      data-empty={emptyDraft ? "true" : undefined}
      aria-busy={sending}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="bw-composer-dock">
        {dock && !sheetOpen && !emptyDraft ? (
          <button
            type="button"
            className="bw-composer-handle"
            aria-label="Show Agent conversation"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          >
            <span className="sheet-handle-bar" />
          </button>
        ) : null}
        <label>
          <span className="sr-only">Message the Agent</span>
          <textarea
            ref={input}
            id="agent-composer"
            rows={1}
            value={draft}
            enterKeyHint="enter"
            placeholder="Ask Agent to modify form…"
            className="placeholder:text-xs"
            disabled={composingLocked}
            aria-invalid={error ? true : undefined}
            style={{ resize: "none" }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (event.shiftKey) return;
              if (event.metaKey || event.ctrlKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <div className="bw-composer-tools">
          {emptyDraft ? null : (
            <button
              type="button"
              className="bw-composer-expand"
              aria-label={sheetOpen || tall ? "Collapse Agent" : "Expand Agent"}
              onClick={onExpandClick}
            >
              {sheetOpen || tall ? (
                <CornersIn size={20} />
              ) : (
                <CornersOut size={20} />
              )}
            </button>
          )}
          <button
            type="submit"
            className="bw-composer-send"
            disabled={!canSend}
            aria-label={sending ? "Sending" : "Send"}
            aria-keyshortcuts="Control+Enter Meta+Enter"
          >
            {sending ? (
              <CircleNotch size={18} className="bw-spinner" />
            ) : (
              <ArrowUp size={18} weight="bold" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
  const thread = (
    <>
      {heading}
      {conversation}
      {errorBar}
      {composer}
    </>
  );
  return (
    <aside
      className="bw-agent-panel"
      data-empty={messages.length ? undefined : "true"}
      data-docked={dock ? "true" : undefined}
    >
      {dock && sheetOpen ? (
        <Sheet
          titleId="agent-sheet-title"
          className="bw-agent-sheet"
          onClose={() => setSheetOpen(false)}
        >
          {thread}
        </Sheet>
      ) : dock ? (
        composer
      ) : (
        thread
      )}
      {preview ? (
        <Modal
          busy={Boolean(working)}
          titleId="proposal-preview-title"
          onClose={() => {
            if (!working) setPreview(null);
          }}
        >
          <div className="bw-proposal-dialog">
            <p className="eyebrow">Proposed · Not applied</p>
            <h2 id="proposal-preview-title">Preview proposed changes</h2>
            <p className="bw-note">
              This is the form the Agent proposes. Your draft has not changed.
            </p>
            {error ? (
              <p role="alert" className="bw-inline-error">
                {error}
              </p>
            ) : null}
            <FormPreview schema={preview.schema} branding={branding} />
            <div className="bw-dialog-actions">
              <button
                type="button"
                className="bw-secondary"
                disabled={unavailable}
                onClick={() => setPreview(null)}
              >
                Close preview
              </button>
              <button
                type="button"
                className="bw-primary"
                disabled={unavailable || stale(sets[preview.id])}
                onClick={() => void decide(preview.id, "apply")}
              >
                {working === "applying" ? "Applying…" : "Apply changes"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </aside>
  );
}
