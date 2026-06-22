import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";

export default function AdminWatches() {
  const utils = trpc.useUtils();
  const { data: watches, isLoading } = trpc.admin.watches.list.useQuery();
  const [archiving, setArchiving] = useState<number | null>(null);
  const [duplicating, setDuplicating] = useState<number | null>(null);

  const archiveMutation = trpc.admin.watches.archive.useMutation({
    onSuccess: () => {
      utils.admin.watches.list.invalidate();
      utils.admin.metrics.invalidate();
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

  const handleArchive = (id: number) => {
    setArchiving(id);
    archiveMutation.mutate({ id });
  };

  const handleDuplicate = (id: number) => {
    setDuplicating(id);
    duplicateMutation.mutate({ id });
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Catalogue</h1>
          <p className="admin-page-subtitle">{watches?.length ?? 0} watches total</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/admin/import" className="button secondary sm">Import URL</Link>
          <Link href="/admin/watches/new" className="button sm">+ Add watch</Link>
        </div>
      </div>

      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h2 className="admin-table-title">All watches</h2>
        </div>
        {isLoading ? (
          <div className="notice">Loading…</div>
        ) : watches && watches.length > 0 ? (
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
              {watches.map(watch => (
                <tr key={watch.id}>
                  <td>
                    <p className="primary">{watch.brand} {watch.model}</p>
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
                    <div style={{ display: "flex", gap: "0.5rem" }}>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="notice">No watches in the catalogue yet. <Link href="/admin/watches/new" style={{ color: "var(--accent)" }}>Add the first one.</Link></div>
        )}
      </div>
    </AdminLayout>
  );
}
