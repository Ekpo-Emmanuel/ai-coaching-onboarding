"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/product/Modal";
import { StatusBadge } from "@/components/product/ui";
import { createWebhookAction, disconnectGoogleAction, retryDeliveryAction, retryFailedAction, rotateWebhookAction, saveSpreadsheetAction, setStatusAction, testGoogleAction, testWebhookAction } from "@/lib/integrations/actions";

type PublicIntegration = {
  id: string; type: "google_sheets" | "webhook"; name: string; status: "connected" | "disabled" | "error";
  lastError: string | null; updatedAt: Date | string; spreadsheetId: string | null; spreadsheetTitle: string | null; endpointUrl: string | null;
};
type PublicDelivery = {
  id: string; integrationId: string; submissionId: string; eventType: string; status: string; attemptCount: number;
  lastAttemptAt: Date | string | null; lastError: string | null; clientId: string | null;
};
type Confirmation = { kind: "disconnect" | "rotate" | "disable"; integration: PublicIntegration };
type Result = { ok?: true; error?: string; signingSecret?: string; title?: string; status?: string };

export function ConnectionsClient({ googleConfigured, integrations, deliveries }: {
  googleConfigured: boolean; integrations: PublicIntegration[]; deliveries: PublicDelivery[];
}) {
  const router = useRouter();
  const lock = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const [secret, setSecret] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [sheetInput, setSheetInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const google = integrations.find(item => item.type === "google_sheets");
  const webhooks = integrations.filter(item => item.type === "webhook");
  const busy = Boolean(pending);

  async function run(key: string, action: () => Promise<Result>, success: string | ((result: Result) => string)) {
    if (lock.current) return false;
    lock.current = true;
    setPending(key); setFeedback(null);
    let completed = false;
    try {
      const result = await action();
      if (result.error) throw new Error(result.error);
      if (result.signingSecret) { setSecret(result.signingSecret); setSecretCopied(false); }
      setFeedback({ text: typeof success === "function" ? success(result) : success, error: result.status === "failed" });
      setConfirmation(null); router.refresh(); completed = true;
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : "Could not update this connection. Please try again.", error: true });
    } finally {
      lock.current = false; setPending("");
      requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ block: "nearest" }));
    }
    return completed;
  }
  function confirm(kind: Confirmation["kind"], integration: PublicIntegration) { setFeedback(null); setConfirmation({ kind, integration }); }
  async function confirmAction() {
    if (!confirmation) return;
    const { kind, integration } = confirmation;
    if (kind === "disconnect") await run("disconnect", () => disconnectGoogleAction(integration.id), "Google Sheets disconnected. Your submissions remain in Coaching.");
    if (kind === "disable") await run("disable", () => setStatusAction(integration.id, "disabled"), "Webhook disabled. You can enable it again when ready.");
    if (kind === "rotate") await run("rotate", () => rotateWebhookAction(integration.id), "Signing secret replaced. Copy the new secret and update your receiver.");
  }

  return <div className="connections-content">
    <p className="connection-intro">Send new onboarding responses to your connected tools. Choose destinations carefully: responses may include health information.</p>
    <div ref={feedbackRef} className="connection-notices">
      {feedback ? <p role={feedback.error ? "alert" : "status"} className={`connection-feedback ${feedback.error ? "feedback-error" : ""}`}>{feedback.text}</p> : null}
      {secret ? <aside className="connection-secret"><h2>Save your signing secret</h2><p>This secret is shown only now. Copy it before leaving this page.</p><code>{secret}</code><button type="button" className="button" onClick={async () => { try { await navigator.clipboard.writeText(secret); setSecretCopied(true); } catch { setFeedback({ text: "Clipboard unavailable. Select and copy the secret above.", error: true }); } }}>{secretCopied ? "Copied" : "Copy secret"}</button></aside> : null}
    </div>
    <section className="connection-card">
      <div className="connection-heading"><h2>Google Sheets</h2><StatusBadge status={google?.status || "disabled"}>{google ? undefined : "Not connected"}</StatusBadge></div>
      <p className="connection-description">Keep a spreadsheet of new client responses.</p>
      {!googleConfigured ? <p className="connection-note">Google Sheets is not available in this workspace yet.</p> : !google || google.status === "disabled" ? <a className="button button-primary" href="/api/integrations/google/start">Connect Google Sheets</a> : <>
        {google.status === "error" ? <p className="connection-note feedback-error">Reconnect your Google account to resume delivery. Existing submissions remain available.</p> : null}
        {google.status === "error" ? <a className="button button-primary" href="/api/integrations/google/start">Reconnect Google Sheets</a> : null}
        {google.spreadsheetId ? <div className="connection-destination"><span>Current destination</span><strong>{google.spreadsheetTitle || "Onboarding spreadsheet"}</strong><a className="text-link" href={`https://docs.google.com/spreadsheets/d/${google.spreadsheetId}`} target="_blank" rel="noreferrer">Open spreadsheet ↗</a></div> : <p className="connection-note">Choose a spreadsheet to start receiving responses.</p>}
        <details className="configuration-details" open={!google.spreadsheetId}><summary>{google.spreadsheetId ? "Change spreadsheet" : "Choose a spreadsheet"}</summary><form className="connection-form" onSubmit={event => { event.preventDefault(); void run("sheet-save", () => saveSpreadsheetAction(google.id, { spreadsheetId: sheetInput }), "Spreadsheet saved."); }}>
          <label>Spreadsheet URL or ID<input value={sheetInput} onChange={event => setSheetInput(event.target.value)} required disabled={busy} placeholder="Paste a Google Sheets link" /></label>
          <button className="button" disabled={busy || !sheetInput.trim()}>{pending === "sheet-save" ? "Saving…" : "Use existing"}</button>
          <span className="connection-or">or</span><button type="button" className="button" disabled={busy} onClick={() => void run("sheet-create", () => saveSpreadsheetAction(google.id, { create: true }), "Created onboarding spreadsheet.")}>{pending === "sheet-create" ? "Creating…" : "Create onboarding spreadsheet"}</button>
        </form></details>
        <div className="connection-actions"><button className="button" type="button" disabled={busy} onClick={() => void run("google-test", () => testGoogleAction(google.id), result => `Connected to ${result.title}.`)}>{pending === "google-test" ? "Testing…" : "Test connection"}</button><button className="quiet-action danger-text" type="button" disabled={busy} onClick={() => confirm("disconnect", google)}>Disconnect</button></div>
      </>}
    </section>
    <section className="connection-card">
      <div className="connection-heading"><h2>Signed webhooks</h2><span className="connection-count">{webhooks.length} {webhooks.length === 1 ? "destination" : "destinations"}</span></div>
      <p className="connection-description">Send responses to a tool that accepts webhook events.</p>
      {webhooks.length ? <ul className="connection-list">{webhooks.map(hook => <li key={hook.id}>
        <div className="connection-heading"><h3>{hook.name}</h3><StatusBadge status={hook.status} /></div><p className="connection-endpoint">{hook.endpointUrl}</p>
        {hook.status === "error" ? <p className="connection-note feedback-error">Delivery needs attention. Check the receiver, then send a test.</p> : null}
        <details className="configuration-details"><summary>Manage {hook.name}</summary><div className="connection-actions">
          <button className="button" type="button" disabled={busy} onClick={() => void run(`test-${hook.id}`, () => testWebhookAction(hook.id), "Test event sent.")}>{pending === `test-${hook.id}` ? "Sending…" : "Send test"}</button>
          <button className="button" type="button" disabled={busy} onClick={() => hook.status === "connected" ? confirm("disable", hook) : void run(`enable-${hook.id}`, () => setStatusAction(hook.id, "connected"), "Webhook enabled.")}>{pending === `enable-${hook.id}` ? "Enabling…" : hook.status === "connected" ? "Disable" : "Enable"}</button>
          <button className="quiet-action" type="button" disabled={busy} onClick={() => void run(`retry-${hook.id}`, () => retryFailedAction(hook.id), "Failed deliveries retried. Check the latest delivery status below.")}>{pending === `retry-${hook.id}` ? "Retrying…" : "Retry all failed"}</button>
          <button className="quiet-action danger-text" type="button" disabled={busy} onClick={() => confirm("rotate", hook)}>Rotate secret</button>
        </div></details>
      </li>)}</ul> : <p className="connection-note">No webhook destinations yet. Add one when you have a receiving endpoint.</p>}
      {!adding && webhooks.length ? <button type="button" className="button" onClick={() => setAdding(true)}>Add webhook</button> : <form className="connection-form" onSubmit={async event => { event.preventDefault(); if (await run("webhook-add", () => createWebhookAction({ name: webhookName, endpointUrl: webhookUrl }), "Webhook added. Save its signing secret before leaving.")) { setWebhookUrl(""); setWebhookName(""); setAdding(false); } }}>
        <label>Webhook name<input required value={webhookName} onChange={event => setWebhookName(event.target.value)} placeholder="Coaching records" disabled={busy} /></label>
        <label>HTTPS endpoint URL<input required type="url" value={webhookUrl} onChange={event => setWebhookUrl(event.target.value)} placeholder="https://example.com/onboarding" disabled={busy} /></label>
        <div className="connection-actions"><button className="button button-primary" disabled={busy}>{pending === "webhook-add" ? "Adding…" : "Add webhook"}</button>{webhooks.length ? <button type="button" className="quiet-action" disabled={busy} onClick={() => setAdding(false)}>Cancel</button> : null}</div>
      </form>}
      <details className="configuration-details connection-technical"><summary>Signing and receiver setup</summary><p>Coaching sends JSON with X-Onboarding-Event, X-Onboarding-Delivery-Id, X-Onboarding-Timestamp, and X-Onboarding-Signature headers. Verify v1=HMAC-SHA256 over the timestamp, a period, and the exact raw body using your signing secret. Reject timestamps older than 5 minutes and compare signatures with a timing-safe function. Return a 2xx response for success.</p></details>
    </section>
    <section className="delivery-history"><div className="section-heading"><h2>Recent deliveries</h2></div>{!deliveries.length ? <p className="connection-note">No deliveries yet. Responses sent to connected tools will appear here.</p> : <ul className="delivery-list">{deliveries.map(item => <li key={item.id}>
      <div className="connection-heading"><h3>{item.eventType.includes("test") ? "Connection test" : "Onboarding response"}</h3><StatusBadge status={item.status} /></div>
      <p className="connection-note">{integrations.find(integration => integration.id === item.integrationId)?.name || "Connected tool"} · {item.attemptCount} {item.attemptCount === 1 ? "attempt" : "attempts"}{item.lastAttemptAt ? ` · ${new Date(item.lastAttemptAt).toLocaleString()}` : ""}</p>
      {item.status === "failed" ? <><p>Delivery failed. Your client’s onboarding is safely stored.</p>{item.lastError ? <details className="configuration-details"><summary>Error details</summary><p>{item.lastError}</p></details> : null}</> : null}
      <div className="connection-actions">{item.clientId ? <a className="quiet-action" href={`/clients/${item.clientId}/submissions/${item.submissionId}`}>View submission</a> : null}{item.status === "failed" || item.status === "pending" ? <button className="button" type="button" disabled={busy} onClick={() => void run(`delivery-${item.id}`, () => retryDeliveryAction(item.id), result => result.status === "sent" ? "Delivery sent." : result.status === "failed" ? "Delivery failed again. Your client’s onboarding is safely stored." : "Delivery queued. Check its status below.")}>{pending === `delivery-${item.id}` ? "Retrying…" : "Retry"}</button> : null}</div>
    </li>)}</ul>}</section>
    {confirmation ? <Modal titleId="connection-confirm-title" busy={busy} onClose={() => setConfirmation(null)}><h2 id="connection-confirm-title">{confirmation.kind === "rotate" ? "Replace signing secret?" : confirmation.kind === "disconnect" ? "Disconnect Google Sheets?" : `Disable ${confirmation.integration.name}?`}</h2><p className="connection-note">{confirmation.kind === "rotate" ? "The current secret will stop working. Update your receiving tool with the new secret before accepting further deliveries." : "New responses will stop being sent to this destination. Your submissions stay in Coaching, and existing external copies remain."}</p>{feedback?.error ? <p className="connection-feedback feedback-error" role="alert">{feedback.text}</p> : null}<div className="dialog-actions"><button className="button" type="button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button><button className="button button-danger" type="button" disabled={busy} onClick={() => void confirmAction()}>{busy ? "Updating…" : confirmation.kind === "rotate" ? "Replace secret" : confirmation.kind === "disconnect" ? "Disconnect" : "Disable webhook"}</button></div></Modal> : null}
  </div>;
}
