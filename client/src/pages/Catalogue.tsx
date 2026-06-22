import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/ProductCard";
import FilterWorkspace, { DraftFilters, EMPTY_FILTERS } from "@/components/FilterWorkspace";

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

const SORT_OPTIONS = [
  { value: "featured", label: "Featured first" },
  { value: "newest", label: "New in" },
  { value: "price_asc", label: "Price (low–high)" },
  { value: "price_desc", label: "Price (high–low)" },
  { value: "brand_az", label: "Brand (A–Z)" },
];

function filtersToQuery(f: DraftFilters) {
  return {
    brand: f.brand || undefined,
    status: f.status,
    category: f.category || undefined,
    condition: f.condition || undefined,
    currency: f.currency || undefined,
    priceMin: numberOrUndefined(f.priceMin),
    priceMax: numberOrUndefined(f.priceMax),
    yearMin: numberOrUndefined(f.yearMin),
    yearMax: numberOrUndefined(f.yearMax),
    material: f.material || undefined,
    movement: f.movement || undefined,
    dialColor: f.dialColor || undefined,
    braceletMaterial: f.braceletMaterial || undefined,
    boxPapers: f.boxPapers || undefined,
    featured: f.featuredOnly || undefined,
    hype: f.hypeOnly || undefined,
    newArrival: f.newOnly || undefined,
  };
}

function getActiveChips(f: DraftFilters): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  if (f.brand) chips.push({ key: "brand", label: f.brand });
  if (f.status !== "all") chips.push({ key: "status", label: f.status === "available" ? "In stock" : f.status });
  if (f.category) chips.push({ key: "category", label: f.category });
  if (f.condition) chips.push({ key: "condition", label: f.condition });
  if (f.currency) chips.push({ key: "currency", label: f.currency });
  if (f.priceMin) chips.push({ key: "priceMin", label: `From ${f.priceMin}` });
  if (f.priceMax) chips.push({ key: "priceMax", label: `To ${f.priceMax}` });
  if (f.yearMin) chips.push({ key: "yearMin", label: `From ${f.yearMin}` });
  if (f.yearMax) chips.push({ key: "yearMax", label: `To ${f.yearMax}` });
  if (f.material) chips.push({ key: "material", label: f.material });
  if (f.movement) chips.push({ key: "movement", label: f.movement });
  if (f.dialColor) chips.push({ key: "dialColor", label: f.dialColor });
  if (f.braceletMaterial) chips.push({ key: "braceletMaterial", label: f.braceletMaterial });
  if (f.boxPapers) chips.push({ key: "boxPapers", label: f.boxPapers });
  if (f.featuredOnly) chips.push({ key: "featuredOnly", label: "Featured" });
  if (f.hypeOnly) chips.push({ key: "hypeOnly", label: "Hype" });
  if (f.newOnly) chips.push({ key: "newOnly", label: "New arrivals" });
  return chips;
}

export default function Catalogue() {
  const [sort, setSort] = useState("featured");
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<DraftFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<DraftFilters>(EMPTY_FILTERS);

  const { data: watches, isLoading, isError } = trpc.watches.list.useQuery({
    ...filtersToQuery(appliedFilters),
    sort,
  });
  const { data: brands } = trpc.watches.brands.useQuery();

  const openFilter = useCallback(() => {
    setDraftFilters({ ...appliedFilters });
    setFilterOpen(true);
  }, [appliedFilters]);

  const closeFilter = useCallback(() => {
    setFilterOpen(false);
  }, []);

  const applyFilter = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
    setFilterOpen(false);
  }, [draftFilters]);

  const resetFilter = useCallback(() => {
    setDraftFilters({ ...EMPTY_FILTERS });
  }, []);

  const removeChip = useCallback((key: string) => {
    setAppliedFilters((prev) => {
      const next = { ...prev };
      if (key === "brand") next.brand = "";
      else if (key === "status") next.status = "all";
      else if (key === "category") next.category = "";
      else if (key === "condition") next.condition = "";
      else if (key === "currency") next.currency = "";
      else if (key === "priceMin") next.priceMin = "";
      else if (key === "priceMax") next.priceMax = "";
      else if (key === "yearMin") next.yearMin = "";
      else if (key === "yearMax") next.yearMax = "";
      else if (key === "material") next.material = "";
      else if (key === "movement") next.movement = "";
      else if (key === "dialColor") next.dialColor = "";
      else if (key === "braceletMaterial") next.braceletMaterial = "";
      else if (key === "boxPapers") next.boxPapers = "";
      else if (key === "featuredOnly") next.featuredOnly = false;
      else if (key === "hypeOnly") next.hypeOnly = false;
      else if (key === "newOnly") next.newOnly = false;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setAppliedFilters({ ...EMPTY_FILTERS });
    setSort("featured");
  }, []);

  const activeChips = getActiveChips(appliedFilters);
  const count = watches?.length ?? 0;
  const hasFilters = activeChips.length > 0 || sort !== "featured";

  return (
    <>
      {/* Skip link */}
      <a href="#catalogue-grid" className="skip-link">Skip to catalogue</a>

      <main style={{ paddingTop: "var(--nav-h)" }}>
        <div className="section page">

          {/* Page header */}
          <div className="cat-header">
            <div>
              <p className="section-eyebrow">Full inventory</p>
              <h1 className="section-title">Catalogue</h1>
            </div>
          </div>

          {/* Toolbar */}
          <div className="cat-toolbar" role="toolbar" aria-label="Catalogue controls">
            <div className="cat-toolbar-left">
              <button
                type="button"
                className={`cat-filter-btn${filterOpen ? " cat-filter-btn-active" : ""}`}
                onClick={openFilter}
                aria-expanded={filterOpen}
                aria-haspopup="dialog"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                  <line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                <span>All Filters</span>
                {activeChips.length > 0 && (
                  <span className="cat-filter-badge">{activeChips.length}</span>
                )}
              </button>

              <span
                className="cat-count"
                aria-live="polite"
                aria-atomic="true"
              >
                {isLoading ? "Loading…" : `${count} piece${count !== 1 ? "s" : ""}`}
              </span>
            </div>

            <div className="cat-toolbar-right">
              <label htmlFor="cat-sort" className="cat-sort-label">Sort</label>
              <select
                id="cat-sort"
                className="cat-sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="cat-chips" role="group" aria-label="Active filters">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="cat-chip"
                  onClick={() => removeChip(chip.key)}
                  aria-label={`Remove filter: ${chip.label}`}
                >
                  {chip.label}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ))}
              {hasFilters && (
                <button type="button" className="cat-chip-clear" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Product grid */}
          {isLoading ? (
            <div className="cat-grid catalogue-grid" id="catalogue-grid" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="pc-skeleton" aria-hidden="true">
                  <div className="pc-skeleton-media" />
                  <div className="pc-skeleton-body">
                    <div className="pc-skeleton-line pc-skeleton-line-short" />
                    <div className="pc-skeleton-line" />
                    <div className="pc-skeleton-line pc-skeleton-line-med" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="cat-state">
              <p className="cat-state-title">Failed to load catalogue</p>
              <p className="cat-state-sub">Please try refreshing the page.</p>
            </div>
          ) : watches && watches.length > 0 ? (
            <div className="cat-grid catalogue-grid" id="catalogue-grid">
              {watches.map((watch) => (
                <ProductCard key={watch.id} {...watch} />
              ))}
            </div>
          ) : (
            <div className="cat-state">
              <div className="cat-state-icon" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <circle cx="12" cy="12" r="7" />
                  <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" />
                  <path d="M12 9v3l2 2" />
                </svg>
              </div>
              <p className="cat-state-title">No watches found</p>
              <p className="cat-state-sub">Try adjusting your filters or clearing all.</p>
              {hasFilters && (
                <button type="button" className="button secondary sm" onClick={clearAll}>
                  Clear all filters
                </button>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Full-screen filter workspace */}
      <FilterWorkspace
        open={filterOpen}
        onClose={closeFilter}
        draft={draftFilters}
        onChange={(patch) => setDraftFilters((prev) => ({ ...prev, ...patch }))}
        onApply={applyFilter}
        onReset={resetFilter}
        brands={brands ?? []}
        resultCount={count}
      />
    </>
  );
}
