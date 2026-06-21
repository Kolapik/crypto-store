import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";

interface WatchFormData {
  brand: string; model: string; reference: string; year: string;
  condition: string; price: string; currency: string; status: string;
  description: string; imageUrl: string; privateSource: string;
}

const EMPTY: WatchFormData = {
  brand: "", model: "", reference: "", year: "",
  condition: "excellent", price: "", currency: "CHF",
  status: "available", description: "", imageUrl: "", privateSource: "",
};

export default function AdminWatchForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const watchId = id ? parseInt(id, 10) : undefined;
  const [, navigate] = useLocation();
  const [form, setForm] = useState<WatchFormData>(EMPTY);
  const [error, setError] = useState("");

  const { data: existing } = trpc.admin.watches.byId.useQuery(
    { id: watchId! },
    { enabled: isEdit && !!watchId }
  );

  useEffect(() => {
    if (existing) {
      setForm({
        brand: existing.brand ?? "",
        model: existing.model ?? "",
        reference: existing.reference ?? "",
        year: existing.year?.toString() ?? "",
        condition: existing.condition ?? "excellent",
        price: existing.price?.toString() ?? "",
        currency: existing.currency ?? "CHF",
        status: existing.status ?? "available",
        description: existing.description ?? "",
        imageUrl: existing.imageUrl ?? "",
        privateSource: existing.privateSource ?? "",
      });
    }
  }, [existing]);

  const utils = trpc.useUtils();

  const createMutation = trpc.admin.watches.create.useMutation({
    onSuccess: () => { utils.admin.watches.list.invalidate(); toast.success("Watch created"); navigate("/admin/watches"); },
    onError: (e) => setError(e.message),
  });

  const updateMutation = trpc.admin.watches.update.useMutation({
    onSuccess: () => { utils.admin.watches.list.invalidate(); toast.success("Watch updated"); navigate("/admin/watches"); },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const payload = {
      brand: form.brand, model: form.model,
      reference: form.reference || undefined,
      year: form.year ? parseInt(form.year) : undefined,
      condition: (form.condition as any) || undefined,
      price: form.price || undefined,
      currency: form.currency || undefined,
      status: (form.status as any) || undefined,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      privateSource: form.privateSource || undefined,
    };
    if (isEdit && watchId) {
      updateMutation.mutate({ id: watchId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = (k: keyof WatchFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{isEdit ? "Edit watch" : "Add watch"}</h1>
          <p className="admin-page-subtitle">{isEdit ? `Editing watch #${watchId}` : "Add a new piece to the catalogue"}</p>
        </div>
        <Link href="/admin/watches" className="button secondary sm">← Back</Link>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "2rem" }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Brand *</label>
              <input className="form-input" value={form.brand} onChange={set("brand")} placeholder="Rolex" required />
            </div>
            <div className="form-group">
              <label className="form-label">Model *</label>
              <input className="form-input" value={form.model} onChange={set("model")} placeholder="Cosmograph Daytona" required />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Reference</label>
              <input className="form-input" value={form.reference} onChange={set("reference")} placeholder="116500LN" />
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <input className="form-input" type="number" value={form.year} onChange={set("year")} placeholder="2023" min="1900" max="2099" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Price</label>
              <input className="form-input" type="number" value={form.price} onChange={set("price")} placeholder="29500" />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={set("currency")}>
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Condition</label>
              <select className="form-select" value={form.condition} onChange={set("condition")}>
                <option value="unworn">Unworn</option>
                <option value="excellent">Excellent</option>
                <option value="very_good">Very Good</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={set("status")}>
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={set("description")} placeholder="Full set with box and papers. Stainless steel case…" />
          </div>

          <div className="form-group">
            <label className="form-label">Image URL</label>
            <input className="form-input" type="url" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />
          </div>

          <div className="form-group">
            <label className="form-label">Private source (internal only)</label>
            <input className="form-input" value={form.privateSource} onChange={set("privateSource")} placeholder="Supplier / boutique name" />
          </div>

          {error && <p style={{ color: "var(--error)", fontSize: "0.82rem" }}>{error}</p>}

          <div style={{ display: "flex", gap: "1rem" }}>
            <button type="submit" className="button" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save changes" : "Create watch"}
            </button>
            <Link href="/admin/watches" className="button secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
