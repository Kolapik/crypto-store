import { useState } from "react";
import { trpc } from "@/lib/trpc";
import WatchCard from "@/components/WatchCard";

export default function Catalogue() {
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState("all");

  const { data: watches, isLoading } = trpc.watches.list.useQuery({ brand: brand || undefined, status });
  const { data: brands } = trpc.watches.brands.useQuery();

  return (
    <main style={{ paddingTop: "var(--nav-h)" }}>
      <div className="section page">
        <div className="section-header" style={{ marginBottom: "1.5rem" }}>
          <div>
            <p className="section-eyebrow">Full inventory</p>
            <h1 className="section-title">Catalogue</h1>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
            {watches?.length ?? 0} piece{watches?.length !== 1 ? "s" : ""} listed
          </p>
        </div>

        {/* Filter toolbar */}
        <div className="filter-toolbar">
          <div className="filter-toolbar-controls">
            <span className="filter-label">Filter by</span>
            <select
              className="filter-select"
              value={brand}
              onChange={e => setBrand(e.target.value)}
            >
              <option value="">All brands</option>
              {(brands ?? []).map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
            </select>
            {(brand || status !== "all") && (
              <button
                className="button ghost sm"
                onClick={() => { setBrand(""); setStatus("all"); }}
              >
                Clear
              </button>
            )}
          </div>
          <span className="filter-count">
            {watches?.length ?? 0} piece{watches?.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="notice">Loading catalogue…</div>
        ) : watches && watches.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mt-8">
            {watches.map(watch => (
              <WatchCard key={watch.id} {...watch} />
            ))}
          </div>
        ) : (
          <div className="notice">No watches match the selected filters.</div>
        )}
      </div>
    </main>
  );
}
