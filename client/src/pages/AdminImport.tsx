import { useState } from "react";
import { Link, useLocation } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ManualImage = {
  filename: string;
  contentType: string;
  dataBase64: string;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function AdminImport() {
  const [, navigate] = useLocation();
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const importMutation = trpc.admin.imports.fromUrl.useMutation({
    onSuccess: (result) => {
      toast.success("Draft created");
      setWarnings(result.warnings);
      navigate(`/admin/watches/${result.watch.id}/edit`);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const handleFiles = (selected: FileList | null) => {
    const next = Array.from(selected ?? []).filter((file) => file.type.startsWith("image/")).slice(0, 6);
    const oversized = next.find((file) => file.size > 5_000_000);
    if (oversized) {
      setError(`${oversized.name} is larger than 5 MB.`);
      return;
    }
    setError("");
    setFiles(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setWarnings([]);

    try {
      const manualImages: ManualImage[] = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          dataBase64: await readFileAsDataUrl(file),
        })),
      );

      importMutation.mutate({
        url,
        manualText: manualText || undefined,
        manualImages: manualImages.length ? manualImages : undefined,
      });
    } catch {
      setError("Could not read selected images.");
    }
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Import from URL</h1>
          <p className="admin-page-subtitle">Creates a private draft for review</p>
        </div>
        <Link href="/admin/watches" className="button secondary sm">Catalogue</Link>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "2rem" }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }}>
          <div className="form-group">
            <label className="form-label">Retailer product URL</label>
            <input
              className="form-input"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.bucherer.com/..."
              required
            />
            <p className="form-help">Allowed: timeworld.ch, bucherer.com, watchfinder.ch, tawatch.ch, emeraude.ch</p>
          </div>

          <div className="form-group">
            <label className="form-label">Pasted supplier text</label>
            <textarea
              className="form-textarea"
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder="Optional specs, reference, price, condition, or notes from the supplier"
              style={{ minHeight: 140 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Manual images</label>
            <input
              className="form-input"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => handleFiles(event.target.files)}
            />
            <p className="form-help">{files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Optional, up to 6 images / 5 MB each"}</p>
          </div>

          {warnings.length > 0 && (
            <div className="notice">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          {error && <p style={{ color: "var(--error)", fontSize: "0.82rem" }}>{error}</p>}

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button type="submit" className="button" disabled={importMutation.isPending}>
              {importMutation.isPending ? "Importing..." : "Create draft"}
            </button>
            <Link href="/admin/watches" className="button secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
