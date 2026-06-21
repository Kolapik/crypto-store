import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: metrics } = trpc.admin.metrics.useQuery();
  const { data: requests } = trpc.admin.requests.list.useQuery();
  const recent = (requests ?? []).slice(0, 8);

  const STATUS_COLORS: Record<string, string> = {
    new: "new", reviewing: "reviewing", confirmed: "confirmed",
    declined: "declined", completed: "completed",
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">Platform overview</p>
        </div>
        <Link href="/admin/watches/new" className="button sm">+ Add watch</Link>
      </div>

      {/* Metric cards */}
      <div className="metric-grid">
        <div className="metric-card blue">
          <p className="metric-value">{metrics?.totalWatches ?? "—"}</p>
          <p className="metric-label">Total watches</p>
        </div>
        <div className="metric-card teal">
          <p className="metric-value">{metrics?.availableWatches ?? "—"}</p>
          <p className="metric-label">Available</p>
        </div>
        <div className="metric-card gold">
          <p className="metric-value">{metrics?.reservedWatches ?? "—"}</p>
          <p className="metric-label">Reserved</p>
        </div>
        <div className="metric-card red">
          <p className="metric-value">{metrics?.newRequests ?? "—"}</p>
          <p className="metric-label">New requests</p>
          {(metrics?.newRequests ?? 0) > 0 && (
            <p className="metric-delta">↑ Needs attention</p>
          )}
        </div>
      </div>

      {/* Recent requests */}
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h2 className="admin-table-title">Recent purchase requests</h2>
          <Link href="/admin/requests" className="button ghost sm">View all</Link>
        </div>
        {recent.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Watch</th>
                <th>Crypto</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(({ request, watch }) => (
                <tr key={request.id}>
                  <td>
                    <p className="primary">{request.customerName}</p>
                    <p className="mono">{request.customerEmail}</p>
                  </td>
                  <td>
                    {watch ? (
                      <span className="primary">{watch.brand} {watch.model}</span>
                    ) : (
                      <span className="mono">—</span>
                    )}
                  </td>
                  <td>
                    <span className="mono">{request.cryptoPreference?.toUpperCase() ?? "—"}</span>
                  </td>
                  <td>
                    <span className={`pill ${STATUS_COLORS[request.status] ?? ""}`}>
                      {request.status}
                    </span>
                  </td>
                  <td>
                    <span className="mono">
                      {new Date(request.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </td>
                </tr>
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
