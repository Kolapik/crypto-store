import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";

interface WatchFormData {
  brand: string;
  model: string;
  title: string;
  reference: string;
  year: string;
  condition: string;
  price: string;
  currency: string;
  status: string;
  visibility: string;
  publicationStatus: string;
  category: string;
  tags: string;
  featured: boolean;
  hype: boolean;
  newArrival: boolean;
  boxPapers: string;
  movement: string;
  caseSize: string;
  material: string;
  dialColor: string;
  braceletMaterial: string;
  description: string;
  imageUrls: string;
  supplierName: string;
  supplierDomain: string;
  supplierUrl: string;
  sourceUrl: string;
  supplierPrice: string;
  acquisitionCost: string;
  internalNotes: string;
  importStatus: string;
  importErrors: string;
}

const EMPTY: WatchFormData = {
  brand: "",
  model: "",
  title: "",
  reference: "",
  year: "",
  condition: "excellent",
  price: "",
  currency: "CHF",
  status: "available",
  visibility: "private",
  publicationStatus: "draft",
  category: "",
  tags: "",
  featured: false,
  hype: false,
  newArrival: false,
  boxPapers: "",
  movement: "",
  caseSize: "",
  material: "",
  dialColor: "",
  braceletMaterial: "",
  description: "",
  imageUrls: "",
  supplierName: "",
  supplierDomain: "",
  supplierUrl: "",
  sourceUrl: "",
  supplierPrice: "",
  acquisitionCost: "",
  internalNotes: "",
  importStatus: "",
  importErrors: "",
};

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function tags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function AdminWatchForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const watchId = id ? parseInt(id, 10) : undefined;
  const [, navigate] = useLocation();
  const [form, setForm] = useState<WatchFormData>(EMPTY);
  const [error, setError] = useState("");

  const { data: existing } = trpc.admin.watches.byId.useQuery(
    { id: watchId! },
    { enabled: isEdit && !!watchId },
  );

  const imageEnhancementsQuery = trpc.admin.imageEnhancements.listForWatch.useQuery(
    { watchId: watchId! },
    { enabled: isEdit && !!watchId },
  );

  useEffect(() => {
    if (!existing) return;
    setForm({
      brand: existing.brand ?? "",
      model: existing.model ?? "",
      title: existing.title ?? "",
      reference: existing.reference ?? "",
      year: existing.year?.toString() ?? "",
      condition: existing.condition ?? "excellent",
      price: existing.price?.toString() ?? "",
      currency: existing.currency ?? "CHF",
      status: existing.status ?? "available",
      visibility: existing.visibility ?? "private",
      publicationStatus: existing.publicationStatus ?? "draft",
      category: existing.category ?? "",
      tags: Array.isArray(existing.tags) ? existing.tags.join(", ") : "",
      featured: existing.featured ?? false,
      hype: existing.hype ?? false,
      newArrival: existing.newArrival ?? false,
      boxPapers: existing.boxPapers ?? "",
      movement: existing.movement ?? "",
      caseSize: existing.caseSize ?? "",
      material: existing.material ?? "",
      dialColor: existing.dialColor ?? "",
      braceletMaterial: existing.braceletMaterial ?? "",
      description: existing.description ?? "",
      imageUrls: Array.isArray(existing.publicImages) ? existing.publicImages.join("\n") : existing.imageUrl ?? "",
      supplierName: existing.supplierName ?? "",
      supplierDomain: existing.supplierDomain ?? "",
      supplierUrl: existing.supplierUrl ?? "",
      sourceUrl: existing.sourceUrl ?? "",
      supplierPrice: existing.supplierPrice?.toString() ?? "",
      acquisitionCost: existing.acquisitionCost?.toString() ?? "",
      internalNotes: existing.internalNotes ?? "",
      importStatus: existing.importStatus ?? "",
      importErrors: Array.isArray(existing.importErrors) ? existing.importErrors.join("\n") : "",
    });
  }, [existing]);

  const utils = trpc.useUtils();

  const createMutation = trpc.admin.watches.create.useMutation({
    onSuccess: () => {
      utils.admin.watches.list.invalidate();
      toast.success("Watch created");
      navigate("/admin/watches");
    },
    onError: (e) => setError(e.message),
  });

  const updateMutation = trpc.admin.watches.update.useMutation({
    onSuccess: () => {
      utils.admin.watches.list.invalidate();
      utils.watches.list.invalidate();
      toast.success("Watch updated");
      navigate("/admin/watches");
    },
    onError: (e) => setError(e.message),
  });

  const enhanceImageMutation = trpc.admin.imageEnhancements.enhance.useMutation({
    onSuccess: (enhancement) => {
      imageEnhancementsQuery.refetch();
      if (enhancement.status === "failed") {
        toast.error(enhancement.errorMessage ?? "Image enhancement failed");
        return;
      }
      toast.success("Enhanced image ready for review");
    },
    onError: (e) => toast.error(e.message),
  });

  const useEnhancedImageMutation = trpc.admin.imageEnhancements.use.useMutation({
    onSuccess: (result) => {
      imageEnhancementsQuery.refetch();
      utils.admin.watches.byId.invalidate({ id: watchId! });
      utils.admin.watches.list.invalidate();
      setForm((current) => ({
        ...current,
        imageUrls: Array.isArray(result.watch.publicImages)
          ? result.watch.publicImages.join("\n")
          : current.imageUrls,
      }));
      toast.success("Enhanced image selected for the watch");
    },
    onError: (e) => toast.error(e.message),
  });

  const payload = () => ({
    brand: form.brand,
    model: form.model,
    title: form.title || undefined,
    reference: form.reference || undefined,
    year: form.year ? parseInt(form.year, 10) : undefined,
    condition: (form.condition as any) || undefined,
    price: form.price || undefined,
    currency: form.currency || undefined,
    status: (form.status as any) || undefined,
    visibility: (form.visibility as any) || undefined,
    publicationStatus: (form.publicationStatus as any) || undefined,
    category: form.category || undefined,
    tags: tags(form.tags),
    featured: form.featured,
    hype: form.hype,
    newArrival: form.newArrival,
    boxPapers: form.boxPapers || undefined,
    movement: form.movement || undefined,
    caseSize: form.caseSize || undefined,
    material: form.material || undefined,
    dialColor: form.dialColor || undefined,
    braceletMaterial: form.braceletMaterial || undefined,
    description: form.description || undefined,
    publicImages: lines(form.imageUrls),
    supplierName: form.supplierName || undefined,
    supplierDomain: form.supplierDomain || undefined,
    supplierUrl: form.supplierUrl || undefined,
    sourceUrl: form.sourceUrl || undefined,
    supplierPrice: form.supplierPrice || undefined,
    acquisitionCost: form.acquisitionCost || undefined,
    internalNotes: form.internalNotes || undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isEdit && watchId) {
      updateMutation.mutate({ id: watchId, ...payload() });
    } else {
      createMutation.mutate(payload());
    }
  };

  const set = (k: keyof WatchFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const publishFields = (current: WatchFormData) => ({
    ...current,
    publicationStatus: "published",
    visibility: "public",
    status: current.status === "hidden" ? "available" : current.status,
  });

  const publishPayload = () => {
    const next = publishFields(form);
    return {
      ...payload(),
      publicationStatus: "published" as const,
      visibility: "public" as const,
      status: (next.status as "available" | "reserved" | "sold" | "hidden") || "available",
    };
  };

  const publishToSite = () => {
    setForm((f) => publishFields(f));

    if (isEdit && watchId) {
      setError("");
      updateMutation.mutate({ id: watchId, ...publishPayload() });
      return;
    }

    toast.message("Set to public. Save the watch to add it to the site.");
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const currentImages = lines(form.imageUrls);

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{isEdit ? "Edit watch" : "Add watch"}</h1>
          <p className="admin-page-subtitle">{isEdit ? `Editing watch #${watchId}` : "Add a new piece to the catalogue"}</p>
        </div>
        <Link href="/admin/watches" className="button secondary sm">Back</Link>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "2rem" }}>
        {form.importStatus && (
          <div className="notice" style={{ marginBottom: "1.25rem" }}>
            <p><strong>Import status:</strong> {form.importStatus}</p>
            {form.importErrors && (
              <div style={{ marginTop: "0.75rem" }}>
                {lines(form.importErrors).map((line) => <p key={line}>{line}</p>)}
              </div>
            )}
          </div>
        )}

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

          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={form.title} onChange={set("title")} placeholder="Rolex Cosmograph Daytona 116500LN" />
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
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={set("category")}>
                <option value="">Uncategorised</option>
                <option value="Rolex">Rolex</option>
                <option value="Patek Philippe">Patek Philippe</option>
                <option value="Audemars Piguet">Audemars Piguet</option>
                <option value="Cartier">Cartier</option>
                <option value="Omega">Omega</option>
                <option value="Richard Mille">Richard Mille</option>
                <option value="Vacheron Constantin">Vacheron Constantin</option>
                <option value="Other watches">Other watches</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tags</label>
              <input className="form-input" value={form.tags} onChange={set("tags")} placeholder="Rolex, Daytona, Hype pieces" />
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
              <label className="form-label">Availability</label>
              <select className="form-select" value={form.status} onChange={set("status")}>
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Publication</label>
              <select className="form-select" value={form.publicationStatus} onChange={set("publicationStatus")}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Visibility</label>
              <select className="form-select" value={form.visibility} onChange={set("visibility")}>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <label className="form-check">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} />
              <span>Featured</span>
            </label>
            <label className="form-check">
              <input type="checkbox" checked={form.hype} onChange={(e) => setForm((f) => ({ ...f, hype: e.target.checked }))} />
              <span>Hype</span>
            </label>
            <label className="form-check">
              <input type="checkbox" checked={form.newArrival} onChange={(e) => setForm((f) => ({ ...f, newArrival: e.target.checked }))} />
              <span>New arrival</span>
            </label>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Box / papers</label>
              <input className="form-input" value={form.boxPapers} onChange={set("boxPapers")} placeholder="Full set" />
            </div>
            <div className="form-group">
              <label className="form-label">Movement</label>
              <input className="form-input" value={form.movement} onChange={set("movement")} placeholder="Automatic chronograph" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Case size</label>
              <input className="form-input" value={form.caseSize} onChange={set("caseSize")} placeholder="40 mm" />
            </div>
            <div className="form-group">
              <label className="form-label">Material</label>
              <input className="form-input" value={form.material} onChange={set("material")} placeholder="Oystersteel" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Dial color</label>
              <input className="form-input" value={form.dialColor} onChange={set("dialColor")} placeholder="White" />
            </div>
            <div className="form-group">
              <label className="form-label">Bracelet material</label>
              <input className="form-input" value={form.braceletMaterial} onChange={set("braceletMaterial")} placeholder="Oystersteel" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={set("description")} placeholder="Full set with box and papers. Stainless steel case..." />
          </div>

          <div className="form-group">
            <label className="form-label">Copied image URLs</label>
            <textarea className="form-textarea" value={form.imageUrls} onChange={set("imageUrls")} placeholder="/uploads/imports/..." />
          </div>

          {isEdit && watchId && currentImages.length > 0 && (
            <div className="admin-image-review">
              <div className="admin-table-header" style={{ padding: 0, borderBottom: "none" }}>
                <h2 className="admin-table-title">AI image enhancement</h2>
              </div>
              <div className="notice">
                Original images stay saved. Enhance creates a separate review copy; click Use enhanced image only after checking the result.
              </div>
              <div className="admin-image-grid">
                {currentImages.map((imageUrl) => (
                  <div className="admin-image-card" key={imageUrl}>
                    <img src={imageUrl} alt="Watch source" />
                    <p className="mono">{imageUrl}</p>
                    <button
                      type="button"
                      className="button secondary sm"
                      disabled={enhanceImageMutation.isPending}
                      onClick={() => enhanceImageMutation.mutate({ watchId, imageUrl })}
                    >
                      {enhanceImageMutation.isPending ? "Enhancing..." : "Enhance image"}
                    </button>
                  </div>
                ))}
              </div>

              {imageEnhancementsQuery.data && imageEnhancementsQuery.data.length > 0 && (
                <div className="admin-enhancement-list">
                  {imageEnhancementsQuery.data.map((enhancement) => (
                    <div className="admin-enhancement-row" key={enhancement.id}>
                      <div>
                        <p className="primary">Enhancement #{enhancement.id}</p>
                        <p className="mono">{enhancement.model} / {enhancement.status} / {enhancement.reviewStatus}</p>
                        {enhancement.errorMessage && <p style={{ color: "var(--error)", fontSize: "0.78rem" }}>{enhancement.errorMessage}</p>}
                      </div>
                      {enhancement.enhancedImageUrl && (
                        <>
                          <img src={enhancement.enhancedImageUrl} alt="Enhanced watch review" />
                          <button
                            type="button"
                            className="button sm"
                            disabled={useEnhancedImageMutation.isPending || enhancement.status !== "completed"}
                            onClick={() => useEnhancedImageMutation.mutate({ watchId, enhancementId: enhancement.id })}
                          >
                            Use enhanced image
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier name (private)</label>
              <input className="form-input" value={form.supplierName} onChange={set("supplierName")} placeholder="Supplier / boutique name" />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier domain (private)</label>
              <input className="form-input" value={form.supplierDomain} onChange={set("supplierDomain")} placeholder="bucherer.com" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier URL (private)</label>
              <input className="form-input" type="url" value={form.supplierUrl} onChange={set("supplierUrl")} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label className="form-label">Source URL (private)</label>
              <input className="form-input" type="url" value={form.sourceUrl} onChange={set("sourceUrl")} placeholder="https://..." />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier price (private)</label>
              <input className="form-input" type="number" value={form.supplierPrice} onChange={set("supplierPrice")} placeholder="27400" />
            </div>
            <div className="form-group">
              <label className="form-label">Acquisition cost (private)</label>
              <input className="form-input" type="number" value={form.acquisitionCost} onChange={set("acquisitionCost")} placeholder="28000" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Internal notes (private)</label>
            <textarea className="form-textarea" value={form.internalNotes} onChange={set("internalNotes")} placeholder="Private compliance, supplier, or negotiation notes..." />
          </div>

          {error && <p style={{ color: "var(--error)", fontSize: "0.82rem" }}>{error}</p>}

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button type="submit" className="button" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save changes" : "Create watch"}
            </button>
            <button type="button" className="button secondary" onClick={publishToSite} disabled={isPending}>
              {isEdit ? "Publish to site" : "Set public"}
            </button>
            <Link href="/admin/watches" className="button secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
