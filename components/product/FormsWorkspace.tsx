import Link from "next/link";
import { FormLibrary } from "./FormLibrary";
import type { FormListItem } from "@/lib/forms/service";

export type FormsFilter = "all" | "draft" | "published" | "archived";
export function FormsWorkspace({ rows, selected, hasActive, hasArchived, sample = false }: { rows: FormListItem[]; selected: FormsFilter; hasActive: boolean; hasArchived: boolean; sample?: boolean }) {
  const href = (filter: FormsFilter) => sample ? `?screen=forms&status=${filter}` : filter === "all" ? "/forms" : `/forms?status=${filter}`;
  const createHref = sample ? "?screen=create" : "/forms/new";
  const firstUse = !hasActive && !hasArchived;
  return <div className="forms-workspace">
    <header className="forms-heading"><div><h1>Forms</h1><p>Create, publish, and share your client onboarding.</p></div><Link className="button button-primary" href={createHref}>Create onboarding form <span aria-hidden="true">+</span></Link></header>
    <div className="forms-list-controls"><nav aria-label="Filter forms">{([["all","Active"],["draft","Drafts"],["published","Published"],["archived","Archived"]] as const).map(([value,label])=><Link key={value} href={href(value)} aria-current={selected===value?"page":undefined}>{label}</Link>)}</nav><p>{rows.length} {rows.length===1?"form":"forms"}<span> · Recently updated first</span></p></div>
    {rows.length ? <FormLibrary rows={[...rows].sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime())}/> : <section className="forms-empty"><h2>{selected==="archived"?"No archived forms":firstUse?"Create your first onboarding":!hasActive?"No active forms":"No forms in this view"}</h2><p>{selected==="archived"?"Forms you archive will appear here. Their responses stay available.":firstUse?"Start with the Agent or write your own questions. Preview before sharing with clients.":!hasActive?"Your forms are archived. Restore one to continue, or create another onboarding.":"Try another filter to find your onboarding forms."}</p><div>{hasArchived && !hasActive && selected!=="archived" ? <Link className="button" href={href("archived")}>View archived forms</Link> : selected!=="all" ? <Link className="button" href={href("all")}>Show active forms</Link> : null}{selected==="all" && <Link className="text-link" href={createHref}>{firstUse?"Start your first form":"Create another form"}</Link>}</div></section>}
  </div>;
}
