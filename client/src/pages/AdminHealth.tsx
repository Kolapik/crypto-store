import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";

export default function AdminHealth() {
  const { data, isLoading, error } = trpc.admin.health.useQuery();

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">System health</h1>
          <p className="admin-page-subtitle">Database, storage, email, and public data separation</p>
        </div>
      </div>

      <div className="admin-table-wrap">
        {isLoading ? (
          <div className="notice">Checking services...</div>
        ) : error ? (
          <div className="notice">Health check failed: {error.message}</div>
        ) : data ? (
          <table className="admin-table">
            <tbody>
              {Object.entries(data).map(([key, value]) => (
                <tr key={key}>
                  <td><span className="primary">{key}</span></td>
                  <td><span className="mono">{String(value)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="notice">No health data available.</div>
        )}
      </div>
    </AdminLayout>
  );
}
