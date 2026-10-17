import { AppShell } from "@/components/product/AppShell";
import { FormsWorkspace } from "@/components/product/FormsWorkspace";
import { getPoolDb } from "@/lib/db/node";
import { listForms } from "@/lib/forms/service";
import { requireWorkspace } from "@/lib/workspace/session";
export const dynamic = "force-dynamic";
export default async function FormsPage({searchParams}:{searchParams:Promise<{status?:string}>}) {
  const {status}=await searchParams;
  const selected=status==="draft" || status==="published" || status==="archived" ? status : "all";
  const {workspace,profile}=await requireWorkspace();
  const forms=await listForms(getPoolDb(),workspace.id,selected==="archived"?"archived":"active");
  // Only an empty active library needs an archive lookup to distinguish first use.
  const hasArchived=selected==="archived" ? forms.length>0 : forms.length===0 && (await listForms(getPoolDb(),workspace.id,"archived")).length>0;
  const rows=forms.filter(row=>selected==="all" || selected==="archived" || row.status===selected);
  return <AppShell businessName={profile.businessName}><main className="workspace-page"><FormsWorkspace rows={rows} selected={selected} hasActive={selected!=="archived" && forms.length>0} hasArchived={hasArchived}/></main></AppShell>;
}
