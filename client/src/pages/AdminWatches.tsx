import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";

type WatchView = "current" | "drafts" | "archived" | "all";

export default function AdminWatches() {
  const utils = trpc.useUtils();
  const { data: watches, isLoading } = trpc.admin.watches.list.useQuery();
  const [view, setView] = useState<WatchView>("current");
  const [archiving, setArchiving] = useState<number | null>(null);
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const isArchived = (watch: NonNullable<typeof watches>[number]) =>
    watch.publicationStatus === "archived" || watch.visibility === "archived";

  const isDraft = (watch: NonNullable<typeof watches>[number]) =>
    !isArchived(watch) && (watch.publicationStatus === "draft" || watch.visibility === "private");

  const visibleWatches = (watches ?? []).filter((watch) => {
    if (view === "archived") return isArchived(watch);
    if (view === "drafts") return isDraft(watch);
    if (view === "current") return !isArchived(watch);
    return true;
  });

  const counts = (watches ?? []).reduce(
    (acc, watch) => {
      acc.all += 1;
      if (isArchived(watch)) acc.archived += 1;
      else {
        acc.current += 1;
        if (isDraft(watch)) acc.drafts += 1;
      }
      return acc;
    },
    { all: 0, current: 0, drafts: 0, archived: 0 },
  );

  const archiveMutation = trpc.admin.watches.archive.useMutation({
    onSuccess: () => {
      utils.admin.watches.list.invalidate();
      utils.admin.metrics.invalidate();
      setView("archived");
      toast.success("Watch archived");
      setArchiving(null);
    },
    onError: (e) => { toast.error(e.message); setArchiving(null); },
  });

  const duplicateMutation = trpc.admin.watches.duplicate.useMutation({
    onSuccess: () => {
      utils.admin.watches.list.invalidate();
      utils.admin.metrics.invalidate();
      toast.success("Watch duplicated as hidden draft");
      setDuplicating(null);
    },
    onError: (e) => { toast.error(e.message); setDuplicating(null); },
  });

  const deleteMutation = trpc.admin.watches.delete.useMutation({
    onSuccess: () => {
      utils.admin.watches.list.invalidate();
      utils.admin.metrics.invalidate();
      utils.watches.list.invalidate();
      toast.success("Watch deleted");
      setDeleting(null);
    },
    onError: (e) => { toast.error(e.message); setDeleting(null); },
  });

  const handleArchive = (id: number) => {
    setArchiving(id);
    archiveMutation.mutate({ id });
  };

  const handleDuplicate = (id: number) => {
    setDuplicating(id);
    duplicateMutation.mutate({ id });
  };

  const handleDelete = (watch: NonNullable<typeof watches>[number]) => {
    const label = `${watch.brand} ${watch.model}`.trim();
    const confirmed = window.confirm(
      `Delete ${label} permanently?\n\nThis cannot be undone. Watches with customer requests are blocked and should be archived instead.`,
    );
    if (!confirmed) return;

    setDeleting(watch.id);
    deleteMutation.mutate({ id: watch.id });
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Catalogue</h1>
          <p className="admin-page-subtitle">
            {counts.current} current · {counts.archived} archived · {counts.all} total
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/admin/import" className="button secondary sm">Import URL</Link>
          <Link href="/admin/watches/new" className="button sm">+ Add watch</Link>
        </div>
      </div>

      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h2 className="admin-table-title">
            {view === "archived" ? "Archived watches" : view === "drafts" ? "Drafts and private watches" : view === "all" ? "All watches" : "Current watches"}
          </h2>
          <div className="admin-filter-tabs" aria-label="Catalogue view">
            {([
              ["current", "Current", counts.current],
              ["drafts", "Drafts", counts.drafts],
              ["archived", "Archived", counts.archived],
              ["all", "All", counts.all],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`admin-filter-tab ${view === key ? "active" : ""}`}
                onClick={() => setView(key)}
              >
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="notice">Loading…</div>
        ) : visibleWatches.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Watch</th>
                <th>Reference</th>
                <th>Year</th>
                <th>Price</th>
                <th>Status</th>
                <th>Publication</th>
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleWatches.map(watch => (
                <tr key={watch.id} className={isArchived(watch) ? "admin-row-muted" : undefined}>
                  <td>
                    <p className="primary">{watch.brand} {watch.model}</p>
                    {isArchived(watch) && <p className="mono">Archived item</p>}
                  </td>
                  <td><span className="mono">{watch.reference ?? "—"}</span></td>
                  <td><span className="mono">{watch.year ?? "—"}</span></td>
                  <td>
                    <span className="primary">
                      {watch.price ? `${watch.currency} ${Number(watch.price).toLocaleString("de-CH")}` : "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${watch.status}`}>{watch.status}</span>
                  </td>
                  <td>
                    <span className={`pill ${watch.publicationStatus}`}>{watch.publicationStatus}</span>
                  </td>
                  <td>
                    <span className="mono">{watch.visibility}{watch.featured ? " / featured" : ""}</span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <Link href={`/admin/watches/${watch.id}/edit`} className="button ghost sm">Edit</Link>
                      <button
                        className="button secondary sm"
                        onClick={() => handleDuplicate(watch.id)}
                        disabled={duplicating === watch.id}
                      >
                        {duplicating === watch.id ? "…" : "Duplicate"}
                      </button>
                      {watch.status !== "hidden" && (
                        <button
                          className="button danger sm"
                          onClick={() => handleArchive(watch.id)}
                          disabled={archiving === watch.id}
                        >
                          {archiving === watch.id ? "…" : "Archive"}
                        </button>
                      )}
                      <button
                        className="button danger sm"
                        onClick={() => handleDelete(watch)}
                        disabled={deleting === watch.id}
                      >
                        {deleting === watch.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="notice">
            {view === "archived"
              ? "No archived watches yet. When you archive one, it will appear here."
              : view === "drafts"
                ? "No draft or private watches yet."
                : "No watches in this view yet."}{" "}
            <Link href="/admin/watches/new" style={{ color: "var(--accent)" }}>Add a watch.</Link>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
