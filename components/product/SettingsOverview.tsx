import Link from "next/link";
import type { ReactNode } from "react";

export function SettingsOverview({ children, sample = false }: { children?: ReactNode; sample?: boolean }) {
  return <div className="settings-layout"><div>
    <div className="settings-index">
      <Link href={sample ? "?screen=profile" : "/settings/profile"}><div><h2>Coaching profile</h2><p>Who you coach, how you work, and the context your Agent uses.</p></div><span className="row-arrow" aria-hidden="true">↗</span></Link>
      <Link href={sample ? "?screen=connections" : "/settings/connections"}><div><h2>Connections</h2><p>Manage Google Sheets, signed webhooks, and delivery history.</p></div><span className="row-arrow" aria-hidden="true">↗</span></Link>
    </div>
    <section className="settings-data"><h2>Workspace data</h2><p>Download your coaching profile, forms, clients, responses, Review Flags, and AI briefs as a JSON file. Connection secrets are excluded.</p>{sample ? <button className="button" disabled>Export workspace · Sample</button> : <a className="button" href="/api/workspace">Export workspace</a>}</section>
    {children}
  </div><aside className="settings-aside"><h2>Your workspace, your context.</h2><p>Updating your coaching profile helps the Agent. It does not change forms you have already published.</p><p className="mt-4">Open your account menu to view your signed-in email or sign out.</p></aside></div>;
}
