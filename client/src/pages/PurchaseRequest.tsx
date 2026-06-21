import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";

export default function PurchaseRequest() {
  const { watchId } = useParams<{ watchId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(watchId, 10);

  const { data: watch } = trpc.watches.list.useQuery({});
  const thisWatch = (watch ?? []).find(w => w.id === id);

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    cryptoPreference: "none" as "btc" | "eth" | "usdt" | "none" | "other",
    message: "",
  });
  const [error, setError] = useState("");

  const createMutation = trpc.requests.create.useMutation({
    onSuccess: () => navigate("/request/confirmation"),
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerName.trim() || !form.customerEmail.trim()) {
      setError("Name and email are required.");
      return;
    }
    createMutation.mutate({ watchId: id, ...form });
  };

  return (
    <main style={{ paddingTop: "var(--nav-h)" }}>
      <div className="section page" style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <p className="section-eyebrow">No payment obligation</p>
          <h1 className="section-title">Request a watch</h1>
          {thisWatch && (
            <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
              {thisWatch.brand} {thisWatch.model}
              {thisWatch.reference ? ` — Ref. ${thisWatch.reference}` : ""}
            </p>
          )}
          <p className="section-lede" style={{ marginTop: "0.75rem" }}>
            Submit your details below. The owner will confirm availability and reach out directly. No invoice or payment is required at this stage.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full name *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Jean Dupont"
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email address *</label>
              <input
                className="form-input"
                type="email"
                placeholder="jean@example.com"
                value={form.customerEmail}
                onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <input
                className="form-input"
                type="tel"
                placeholder="+41 79 000 00 00"
                value={form.customerPhone}
                onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Crypto payment preference</label>
              <select
                className="form-select"
                value={form.cryptoPreference}
                onChange={e => setForm(f => ({ ...f, cryptoPreference: e.target.value as any }))}
              >
                <option value="none">No preference / Fiat</option>
                <option value="btc">Bitcoin (BTC)</option>
                <option value="eth">Ethereum (ETH)</option>
                <option value="usdt">Tether (USDT)</option>
                <option value="other">Other crypto</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Message (optional)</label>
            <textarea
              className="form-textarea"
              placeholder="Any questions or details about your request…"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            />
          </div>

          {error && (
            <p style={{ color: "var(--error)", fontSize: "0.82rem" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              className="button lg"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Sending…" : "Submit request"}
            </button>
            <Link href={`/watches/${thisWatch?.slug ?? ""}`} className="button secondary">
              Cancel
            </Link>
          </div>

          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            By submitting this form you agree to be contacted by the owner regarding this watch. No payment or commitment is made at this stage.
          </p>
        </form>
      </div>
    </main>
  );
}
