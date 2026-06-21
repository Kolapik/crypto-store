import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";

const CONDITION_LABELS: Record<string, string> = {
  unworn: "Unworn", excellent: "Excellent", very_good: "Very Good", good: "Good", fair: "Fair",
};

function hashFromSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (Math.imul(31, h) + slug.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, "0").toUpperCase();
}

export default function WatchDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: watch, isLoading, error } = trpc.watches.bySlug.useQuery({ slug });

  if (isLoading) return (
    <main style={{ paddingTop: "var(--nav-h)" }}>
      <div className="section page"><div className="notice">Loading…</div></div>
    </main>
  );

  if (error || !watch) return (
    <main style={{ paddingTop: "var(--nav-h)" }}>
      <div className="section page">
        <div className="notice">Watch not found. <Link href="/catalogue" style={{ color: "var(--accent)" }}>Back to catalogue</Link></div>
      </div>
    </main>
  );

  const hash = hashFromSlug(watch.slug);
  const condLabel = watch.condition ? CONDITION_LABELS[watch.condition] ?? watch.condition : null;
  const isAvailable = watch.status === "available";

  return (
    <main>
      <div className="section page">
        <div className="watch-detail">
          {/* ── Gallery ── */}
          <div className="watch-detail-gallery">
            <div className="watch-detail-main-image">
              {watch.imageUrl ? (
                <img src={watch.imageUrl} alt={`${watch.brand} ${watch.model}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)" }}>
                  <div style={{ width: 80, height: 80, border: "2px solid var(--border-strong)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <circle cx="12" cy="12" r="7" />
                      <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" />
                      <path d="M12 9v3l2 2" />
                    </svg>
                  </div>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: "0.72rem", color: "var(--text-muted)", letterSpacing: "0.08em" }}>0x{hash}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Info panel ── */}
          <div className="watch-detail-info">
            <p className="watch-detail-brand">{watch.brand}</p>
            <h1 className="watch-detail-title">{watch.model}</h1>
            {watch.reference && (
              <p className="watch-detail-ref">Ref. {watch.reference}</p>
            )}

            <p className="watch-detail-price">
              {watch.price
                ? `${watch.currency ?? "CHF"} ${Number(watch.price).toLocaleString("de-CH")}`
                : "Price on request"}
            </p>

            <span className={`pill ${watch.status}`} style={{ marginBottom: "1.5rem", display: "inline-flex" }}>
              {watch.status}
            </span>

            {/* Specs */}
            <div className="watch-detail-specs">
              {watch.year && (
                <div className="spec-item">
                  <p className="spec-label">Year</p>
                  <p className="spec-value">{watch.year}</p>
                </div>
              )}
              {condLabel && (
                <div className="spec-item">
                  <p className="spec-label">Condition</p>
                  <p className="spec-value">{condLabel}</p>
                </div>
              )}
              {watch.currency && (
                <div className="spec-item">
                  <p className="spec-label">Currency</p>
                  <p className="spec-value">{watch.currency}</p>
                </div>
              )}
              {watch.reference && (
                <div className="spec-item">
                  <p className="spec-label">Reference</p>
                  <p className="spec-value" style={{ fontFamily: "'Courier New', monospace", fontSize: "0.82rem" }}>{watch.reference}</p>
                </div>
              )}
            </div>

            {watch.description && (
              <p className="watch-detail-description">{watch.description}</p>
            )}

            {/* CTA */}
            <div className="watch-detail-cta">
              {isAvailable ? (
                <>
                  <Link href={`/request/${watch.id}`} className="button lg" style={{ textAlign: "center" }}>
                    Request this watch
                  </Link>
                  <p className="cta-disclaimer">
                    No payment obligation. The owner will confirm availability and contact you directly to discuss next steps.
                  </p>
                </>
              ) : (
                <>
                  <button className="button lg" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                    {watch.status === "reserved" ? "Currently reserved" : "No longer available"}
                  </button>
                  <p className="cta-disclaimer">
                    This piece is no longer available. <Link href="/catalogue" style={{ color: "var(--accent)" }}>Browse the catalogue</Link> for other options.
                  </p>
                </>
              )}
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <Link href="/catalogue" style={{ color: "var(--text-muted)", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                ← Back to catalogue
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
