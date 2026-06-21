import AdminLayout from "@/components/AdminLayout";

interface Props {
  title: string;
  subtitle?: string;
}

export default function AdminPlaceholder({ title, subtitle }: Props) {
  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{title}</h1>
          {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="notice" style={{ marginTop: "2rem" }}>
        This section is coming soon.
      </div>
    </AdminLayout>
  );
}
