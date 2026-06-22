import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import ProductCard, { ProductCardSkeleton } from "@/components/ProductCard";
import FilterWorkspace, { DraftFilters, EMPTY_FILTERS } from "@/components/FilterWorkspace";

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const SORT_OPTIONS = [
  { value: "featured", label: "Relevance" },
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
  if (f.status !== "all") chips.push({ key: "status", label: "In stock" });
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

/* ─── Sort chevron SVG ───────────────────────────────────────────────────── */
function SortChevron() {
  return (
    <svg viewBox="0 0 12 11" width="10" height="10" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M6.3657 11L11.8657 5.5L6.3657 0L5.75358 0.612112L10.2086 5.06717H0V5.93283L10.2086 5.93283L5.75358 10.3879L6.3657 11Z" />
    </svg>
  );
}

/* ─── X chip icon ────────────────────────────────────────────────────────── */
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function Catalogue() {
  const [sort, setSort] = useState("featured");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
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

  const closeFilter = useCallback(() => setFilterOpen(false), []);

  const applyFilter = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
    setFilterOpen(false);
  }, [draftFilters]);

  const resetFilter = useCallback(() => setDraftFilters({ ...EMPTY_FILTERS }), []);

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
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Relevance";

  return (
    <>
      {/* Skip link */}
      <a href="#catalogue-grid" className="buc-skip-link">Skip to catalogue</a>

      <main style={{ paddingTop: "var(--nav-h)" }}>

        {/* ── Bucherer sticky toolbar — height:98px, position:fixed ── */}
        <div className="buc-toolbar-sentinel" aria-hidden="true" />
        <div className="buc-toolbar" role="toolbar" aria-label="Catalogue controls">
          <div className="buc-toolbar__inner">

            {/* Left cluster: brand pill + All Filters */}
            <div className="buc-toolbar__left">
              {/* "Rolex Certified Pre-Owned" style pill — here: our store name */}
              <button
                type="button"
                className="buc-toolbar__brand-pill"
                onClick={clearAll}
                aria-label="Clear all filters"
              >
                Helvetic Reserve
              </button>

              {/* Brand quick-filter pills (from DB) */}
              {(brands ?? []).slice(0, 4).map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`buc-toolbar__brand-pill${appliedFilters.brand === b ? " buc-toolbar__brand-pill--active" : ""}`}
                  onClick={() => {
                    setAppliedFilters((prev) => ({
                      ...prev,
                      brand: prev.brand === b ? "" : b,
                    }));
                  }}
                  aria-pressed={appliedFilters.brand === b}
                >
                  {b}
                </button>
              ))}

              {/* All Filters button */}
              <button
                type="button"
                className={`buc-toolbar__filters-btn${filterOpen ? " buc-toolbar__filters-btn--active" : ""}`}
                onClick={openFilter}
                aria-expanded={filterOpen}
                aria-haspopup="dialog"
              >
                All Filters
                {activeChips.length > 0 && (
                  <span className="buc-toolbar__filters-badge">{activeChips.length}</span>
                )}
              </button>
            </div>

            {/* Right cluster: product count + Sort By */}
            <div className="buc-toolbar__right">
              {/* Product count — Bucherer: button style, not interactive */}
              <button
                type="button"
                className="buc-toolbar__count"
                aria-live="polite"
                aria-atomic="true"
                onClick={openFilter}
              >
                {isLoading ? "—" : `${count} Product${count !== 1 ? "s" : ""}`}
              </button>

              {/* Sort By dropdown — Bucherer: custom dropdown button */}
              <div className="buc-toolbar__sort-wrap">
                <button
                  type="button"
                  className={`buc-toolbar__sort-btn${sortOpen ? " buc-toolbar__sort-btn--open" : ""}`}
                  onClick={() => setSortOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                >
                  <span>Sort By {sortLabel}</span>
                  <span className="buc-toolbar__sort-chevron"><SortChevron /></span>
                </button>
                {sortOpen && (
                  <ul
                    className="buc-toolbar__sort-menu"
                    role="listbox"
                    aria-label="Sort options"
                    onMouseLeave={() => setSortOpen(false)}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <li
                        key={o.value}
                        role="option"
                        aria-selected={sort === o.value}
                        className={`buc-toolbar__sort-option${sort === o.value ? " buc-toolbar__sort-option--active" : ""}`}
                        onClick={() => { setSort(o.value); setSortOpen(false); }}
                      >
                        {o.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── Page content ── */}
        <div className="buc-catalogue-page">

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="buc-chips" role="group" aria-label="Active filters">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="buc-chip"
                  onClick={() => removeChip(chip.key)}
                  aria-label={`Remove filter: ${chip.label}`}
                >
                  {chip.label}
                  <XIcon />
                </button>
              ))}
              {hasFilters && (
                <button type="button" className="buc-chip buc-chip--clear" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Product grid — Bucherer: 8-col grid on desktop, 2-col on mobile */}
          {isLoading ? (
            <div className="buc-grid" id="catalogue-grid" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="buc-grid__item">
                  <ProductCardSkeleton />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="buc-state">
              <p className="buc-state__title">Failed to load catalogue</p>
              <p className="buc-state__sub">Please try refreshing the page.</p>
            </div>
          ) : watches && watches.length > 0 ? (
            <div className="buc-grid" id="catalogue-grid">
              {watches.map((watch) => (
                <div key={watch.id} className="buc-grid__item">
                  <ProductCard {...watch} />
                </div>
              ))}
            </div>
          ) : (
            <div className="buc-state">
              <div className="buc-state__icon" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="7" />
                  <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" />
                  <path d="M12 9v3l2 2" />
                </svg>
              </div>
              <p className="buc-state__title">No watches found</p>
              <p className="buc-state__sub">Try adjusting your filters.</p>
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
