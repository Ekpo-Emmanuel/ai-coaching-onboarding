import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/product/AppShell";
import { getPoolDb } from "@/lib/db/node";
import { listFormSubmissions } from "@/lib/clients/service";
import { FormServiceError } from "@/lib/forms/errors";
import { getWorkspaceForm } from "@/lib/forms/service";
import { PageHeader, EmptyState, StatusBadge } from "@/components/product/ui";
import { requireWorkspace } from "@/lib/workspace/session";

export const dynamic = "force-dynamic";

export default async function FormSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { formId } = await params;
  const { status } = await searchParams;
  const filter =
    status === "new" || status === "needs_review" || status === "reviewed" ? status : undefined;
  const { workspace, profile } = await requireWorkspace();
  const loaded = await loadRows(workspace.id, formId, filter);
  if (!loaded) notFound();

  return (
    <AppShell businessName={profile.businessName}>
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <Link href={`/forms/${formId}/build`} className="page-back">
          ← Back to editor
        </Link>
        <PageHeader eyebrow="Form responses" title={loaded.form.name} description="Review the people who completed this onboarding." action={<a className="button" href={`/api/forms/${formId}/submissions/export`}>Export CSV</a>} />
        <nav className="filter-tabs" aria-label="Filter responses">
          {[
            { id: "all", label: "All" },
            { id: "new", label: "New" },
            { id: "needs_review", label: "Needs review" },
            { id: "reviewed", label: "Reviewed" },
          ].map((item) => (
            <Link
              key={item.id}
              href={item.id === "all" ? `/forms/${formId}/submissions` : `/forms/${formId}/submissions?status=${item.id}`}
              aria-current={(filter ?? "all") === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {loaded.rows.length === 0 ? (
          <div className="mt-8"><EmptyState title={filter ? "No matching responses." : "No responses yet."} description={filter ? "Try another review status or view all responses." : "Responses appear here when clients complete your published onboarding."} href={filter ? `/forms/${formId}/submissions` : `/forms/${formId}/build`} action={filter ? "Clear filters" : "Open form"} /></div>
        ) : (
          <ul className="data-list mt-8">
            {loaded.rows.map((row) => (
              <li key={row.submission.id}>
                <Link
                  href={`/clients/${row.client.id}/submissions/${row.submission.id}`}
                  className="data-row"
                >
                  <div className="row-main"><strong>{row.client.fullName}</strong>
                  <p className="text-sm text-muted">
                    Version {row.versionNumber} · {row.submission.submittedAt.toLocaleString()}
                  </p></div><StatusBadge status={row.submission.reviewStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

async function loadRows(
  workspaceId: string,
  formId: string,
  status?: "new" | "needs_review" | "reviewed",
) {
  const db = getPoolDb();
  try {
    const record = await getWorkspaceForm(db, workspaceId, formId);
    const rows = await listFormSubmissions(db, workspaceId, formId, status);
    return { form: record, rows };
  } catch (error) {
    if (error instanceof FormServiceError && error.status === 404) return null;
    throw error;
  }
}
