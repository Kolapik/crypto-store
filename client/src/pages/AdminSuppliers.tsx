import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type SupplierForm = {
  privateName: string;
  catalogueUrl: string;
  allowedHostname: string;
  allowedPathPrefixes: string;
  permissionReference: string;
  defaultMarkupPercent: string;
  targetCurrency: string;
  syncIntervalMinutes: string;
  discoveryIntervalMinutes: string;
  autoPublish: boolean;
  downloadImages: boolean;
};

const INITIAL_FORM: SupplierForm = {
  privateName: "",
  catalogueUrl: "",
  allowedHostname: "",
  allowedPathPrefixes: "",
  permissionReference: "",
  defaultMarkupPercent: "20.00",
  targetCurrency: "CHF",
  syncIntervalMinutes: "30",
  discoveryIntervalMinutes: "1440",
  autoPublish: false,
  downloadImages: true,
};

function splitPrefixes(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMoney(currency?: string | null, price?: string | null) {
  if (!price) return "-";
  return `${currency ?? ""} ${Number(price).toLocaleString("de-CH")}`.trim();
}

export default function AdminSuppliers() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<SupplierForm>(INITIAL_FORM);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState("");
  const [lastAction, setLastAction] = useState("");

  const suppliersQuery = trpc.admin.suppliers.list.useQuery(undefined, {
    refetchInterval: 8000,
  });
  const categoriesQuery = trpc.admin.suppliers.categories.useQuery();
  const productsQuery = trpc.admin.suppliers.products.useQuery(
    {
      supplierId: selectedSupplierId,
      status: statusFilter || undefined,
    },
    { refetchInterval: 8000 },
  );
  const runsQuery = trpc.admin.suppliers.runs.useQuery(
    { supplierId: selectedSupplierId },
    { refetchInterval: 5000 },
  );

  useEffect(() => {
    if (!selectedSupplierId && suppliersQuery.data?.[0]) {
      setSelectedSupplierId(suppliersQuery.data[0].id);
    }
  }, [selectedSupplierId, suppliersQuery.data]);

  const selectedSupplier = useMemo(
    () => suppliersQuery.data?.find((supplier) => supplier.id === selectedSupplierId),
    [selectedSupplierId, suppliersQuery.data],
  );

  const refresh = () => {
    utils.admin.suppliers.list.invalidate();
    utils.admin.suppliers.products.invalidate();
    utils.admin.suppliers.runs.invalidate();
    utils.admin.metrics.invalidate();
  };

  const createMutation = trpc.admin.suppliers.create.useMutation({
    onSuccess: (supplier) => {
      toast.success("Supplier saved");
      setForm(INITIAL_FORM);
      setSelectedSupplierId(supplier.id);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const discoverMutation = trpc.admin.suppliers.discover.useMutation({
    onSuccess: (result) => {
      setLastAction(result.queued ? `Discovery queued as job ${result.jobId}` : "Discovery ran inline");
      toast.success(result.queued ? "Discovery queued" : "Discovery complete");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const syncMutation = trpc.admin.suppliers.sync.useMutation({
    onSuccess: (result) => {
      setLastAction(result.queued ? `Sync queued as job ${result.jobId}` : "Sync ran inline");
      toast.success(result.queued ? "Sync queued" : "Sync complete");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const suspendMutation = trpc.admin.suppliers.suspend.useMutation({
    onSuccess: () => {
      toast.success("Supplier suspended");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const retryMutation = trpc.admin.suppliers.retryProduct.useMutation({
    onSuccess: () => {
      toast.success("Retry started");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const draftMutation = trpc.admin.suppliers.createWatchDraft.useMutation({
    onSuccess: () => {
      toast.success("Private watch draft created");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const categoryMutation = trpc.admin.suppliers.mapCategory.useMutation({
    onSuccess: () => {
      toast.success("Category mapping saved");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const submitSupplier = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      privateName: form.privateName,
      catalogueUrl: form.catalogueUrl,
      allowedHostname: form.allowedHostname || undefined,
      allowedPathPrefixes: splitPrefixes(form.allowedPathPrefixes),
      permissionReference: form.permissionReference || undefined,
      defaultMarkupPercent: form.defaultMarkupPercent,
      targetCurrency: form.targetCurrency.toUpperCase(),
      syncIntervalMinutes: Number(form.syncIntervalMinutes),
      discoveryIntervalMinutes: Number(form.discoveryIntervalMinutes),
      autoPublish: form.autoPublish,
      downloadImages: form.downloadImages,
    });
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Fournisseurs</h1>
          <p className="admin-page-subtitle">
            Supplier discovery, draft imports, diagnostics, category mapping, and safe sync controls
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="button secondary sm"
            disabled={!selectedSupplierId || discoverMutation.isPending}
            onClick={() => selectedSupplierId && discoverMutation.mutate({ supplierId: selectedSupplierId })}
          >
            Discovery
          </button>
          <button
            className="button sm"
            disabled={!selectedSupplierId || syncMutation.isPending}
            onClick={() => selectedSupplierId && syncMutation.mutate({ supplierId: selectedSupplierId })}
          >
            Sync stock/prices
          </button>
        </div>
      </div>

      {lastAction && <div className="notice" style={{ marginBottom: "1rem" }}>{lastAction}</div>}

      <div className="supplier-admin-grid">
        <div className="admin-table-wrap">
          <div className="admin-table-header">
            <h2 className="admin-table-title">Create / update supplier</h2>
          </div>
          <form onSubmit={submitSupplier} style={{ display: "grid", gap: "1rem", padding: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Private supplier name</label>
              <input className="form-input" value={form.privateName} onChange={(e) => setForm({ ...form, privateName: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Catalogue URL</label>
              <input className="form-input" type="url" value={form.catalogueUrl} onChange={(e) => setForm({ ...form, catalogueUrl: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Allowed hostname</label>
              <input className="form-input" value={form.allowedHostname} onChange={(e) => setForm({ ...form, allowedHostname: e.target.value })} placeholder="Auto from catalogue URL" />
            </div>
            <div className="form-group">
              <label className="form-label">Allowed path prefixes</label>
              <input className="form-input" value={form.allowedPathPrefixes} onChange={(e) => setForm({ ...form, allowedPathPrefixes: e.target.value })} placeholder="/shop, /catalogue" />
            </div>
            <div className="form-group">
              <label className="form-label">Permission reference</label>
              <textarea className="form-textarea" value={form.permissionReference} onChange={(e) => setForm({ ...form, permissionReference: e.target.value })} style={{ minHeight: 80 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="form-group">
                <label className="form-label">Markup %</label>
                <input className="form-input" value={form.defaultMarkupPercent} onChange={(e) => setForm({ ...form, defaultMarkupPercent: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input className="form-input" value={form.targetCurrency} onChange={(e) => setForm({ ...form, targetCurrency: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <label className="form-label" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input type="checkbox" checked={form.downloadImages} onChange={(e) => setForm({ ...form, downloadImages: e.target.checked })} />
                Copy images
              </label>
              <label className="form-label" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input type="checkbox" checked={form.autoPublish} onChange={(e) => setForm({ ...form, autoPublish: e.target.checked })} />
                Auto publish
              </label>
            </div>
            <button className="button" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save supplier"}
            </button>
          </form>
        </div>

        <div style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
          <div className="admin-table-wrap">
            <div className="admin-table-header">
              <h2 className="admin-table-title">Configured suppliers</h2>
            </div>
            {suppliersQuery.isLoading ? (
              <div className="notice">Loading suppliers...</div>
            ) : suppliersQuery.data?.length ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Host</th>
                    <th>Products</th>
                    <th>Last run</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersQuery.data.map((supplier) => (
                    <tr key={supplier.id}>
                      <td><button className="button ghost sm" onClick={() => setSelectedSupplierId(supplier.id)}>{supplier.privateName}</button></td>
                      <td><span className="mono">{supplier.allowedHostname}</span></td>
                      <td>{supplier.productCount} <span className="mono">/ {supplier.needsReviewCount} review</span></td>
                      <td><span className="mono">{supplier.lastRun?.status ?? "-"}</span></td>
                      <td><span className={`pill ${supplier.active ? "available" : "hidden"}`}>{supplier.active ? "active" : "suspended"}</span></td>
                      <td>
                        <button className="button danger sm" disabled={!supplier.active || suspendMutation.isPending} onClick={() => suspendMutation.mutate({ id: supplier.id })}>
                          Suspend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="notice">No suppliers configured yet.</div>
            )}
          </div>

          <div className="admin-table-wrap">
            <div className="admin-table-header">
              <h2 className="admin-table-title">
                Products {selectedSupplier ? `from ${selectedSupplier.privateName}` : ""}
              </h2>
              <select className="form-input" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="needs_review">Needs review</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="unavailable">Unavailable</option>
                <option value="error">Error</option>
              </select>
            </div>
            {productsQuery.isLoading ? (
              <div className="notice">Loading products...</div>
            ) : productsQuery.data?.length ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Review</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productsQuery.data.map((row) => (
                    <tr key={row.product.id}>
                      <td>
                        <p className="primary">{row.product.sourceTitle}</p>
                        <p className="mono">{row.product.sourceBrand ?? row.supplier.privateName}</p>
                      </td>
                      <td>
                        <select
                          className="form-input"
                          value={row.category?.id ?? ""}
                          onChange={(event) => {
                            const destinationCategoryId = Number(event.target.value);
                            const sourceValue = row.product.sourceCategory ?? row.product.productType ?? row.product.sourceTitle;
                            if (!destinationCategoryId || !sourceValue) return;
                            categoryMutation.mutate({
                              supplierId: row.product.supplierId,
                              productId: row.product.id,
                              sourceValue,
                              sourceType: row.product.sourceCategory ? "category" : "title",
                              destinationCategoryId,
                            });
                          }}
                        >
                          <option value="">Unmapped</option>
                          {categoriesQuery.data?.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className="primary">{formatMoney(row.product.publicCurrency, row.product.publicPrice)}</span>
                        <p className="mono">supplier {formatMoney(row.product.supplierCurrency, row.product.supplierPrice)}</p>
                      </td>
                      <td><span className="mono">{row.product.availability}</span></td>
                      <td><span className={`pill ${row.product.status}`}>{row.product.status}</span></td>
                      <td><span className="mono">{row.product.reviewReason ?? "-"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <a className="button ghost sm" href={row.product.canonicalUrl} target="_blank" rel="noreferrer">Source</a>
                          <button className="button secondary sm" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate({ productId: row.product.id })}>Retry</button>
                          {row.product.productType === "watch" && (
                            <button className="button sm" disabled={draftMutation.isPending} onClick={() => draftMutation.mutate({ productId: row.product.id })}>
                              Watch draft
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="notice">No supplier products yet. Run discovery after saving a supplier.</div>
            )}
          </div>

          <div className="admin-table-wrap">
            <div className="admin-table-header">
              <h2 className="admin-table-title">Recent sync runs</h2>
            </div>
            {runsQuery.data?.length ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Products</th>
                    <th>Errors</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runsQuery.data.slice(0, 8).map((run) => (
                    <tr key={run.id}>
                      <td><span className="mono">{run.type}</span></td>
                      <td><span className={`pill ${run.status}`}>{run.status}</span></td>
                      <td>{run.productsDiscovered} / {run.productsUpdated} updated</td>
                      <td>{run.errorsCount}</td>
                      <td><span className="mono">{run.startedAt ? new Date(run.startedAt).toLocaleString() : "-"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="notice">No sync runs yet.</div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
