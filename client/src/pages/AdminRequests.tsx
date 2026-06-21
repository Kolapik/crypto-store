import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";

const STATUSES = ["new", "reviewing", "confirmed", "declined", "completed"] as const;
type Status = typeof STATUSES[number];

export default function AdminRequests() {
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.admin.requests.list.useQuery();
  const [updating, setUpdating] = useState<number | null>(null);
  const [notesMap, setNotesMap] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const updateMutation = trpc.admin.requests.updateStatus.useMutation({
    onSuccess: () => {
      utils.admin.requests.list.invalidate();
      utils.admin.metrics.invalidate();
      toast.success("Status updated");
      setUpdating(null);
    },
    onError: (e) => { toast.error(e.message); setUpdating(null); },
  });

  const handleStatusChange = (id: number, status: Status) => {
    setUpdating(id);
    updateMutation.mutate({ id, status, adminNotes: notesMap[id] });
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Purchase requests</h1>
          <p className="admin-page-subtitle">{requests?.length ?? 0} total requests</p>
        </div>
      </div>

      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h2 className="admin-table-title">All requests</h2>
        </div>
        {isLoading ? (
          <div className="notice">Loading…</div>
        ) : requests && requests.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Watch</th>
                <th>Crypto</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(({ request, watch }) => (
                <>
                  <tr key={request.id} style={{ cursor: "pointer" }} onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}>
                    <td>
                      <p className="primary">{request.customerName}</p>
                      <p className="mono">{request.customerEmail}</p>
                      {request.customerPhone && <p className="mono">{request.customerPhone}</p>}
                    </td>
                    <td>
                      {watch ? (
                        <span className="primary">{watch.brand} {watch.model}</span>
                      ) : <span className="mono">—</span>}
                    </td>
                    <td>
                      <span className="mono">{request.cryptoPreference?.toUpperCase() ?? "—"}</span>
                    </td>
                    <td>
                      <span className={`pill ${request.status}`}>{request.status}</span>
                    </td>
                    <td>
                      <span className="mono">
                        {new Date(request.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <select
                        className="filter-select"
                        style={{ minWidth: 120 }}
                        value={request.status}
                        disabled={updating === request.id}
                        onChange={e => handleStatusChange(request.id, e.target.value as Status)}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {expandedId === request.id && (
                    <tr key={`${request.id}-expanded`}>
                      <td colSpan={6} style={{ background: "var(--bg-elevated)", padding: "1rem 1.5rem" }}>
                        {request.message && (
                          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                            <strong style={{ color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Customer message:</strong><br />
                            {request.message}
                          </p>
                        )}
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Admin notes</label>
                            <input
                              className="form-input"
                              placeholder="Internal notes…"
                              value={notesMap[request.id] ?? request.adminNotes ?? ""}
                              onChange={e => setNotesMap(m => ({ ...m, [request.id]: e.target.value }))}
                            />
                          </div>
                          <button
                            className="button sm"
                            onClick={() => handleStatusChange(request.id, request.status as Status)}
                            disabled={updating === request.id}
                          >
                            Save notes
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="notice">No purchase requests yet.</div>
        )}
      </div>
    </AdminLayout>
  );
}
