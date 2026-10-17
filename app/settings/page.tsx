import { SettingsOverview } from "@/components/product/SettingsOverview";
import { PageHeader } from "@/components/product/ui";
import { AppShell } from "@/components/product/AppShell";
import { requireWorkspace } from "@/lib/workspace/session";
import { WorkspaceDangerZone } from "./WorkspaceDangerZone";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile, workspace } = await requireWorkspace();
  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <PageHeader eyebrow="Your workspace" title="Settings" description={workspace.name} />
        <SettingsOverview><WorkspaceDangerZone /></SettingsOverview>
      </main>
    </AppShell>
  );
}
