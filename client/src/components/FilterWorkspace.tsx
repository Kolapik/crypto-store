import { useEffect, useRef, useState, useCallback } from "react";

export type DraftFilters = {
  brand: string;
  status: string;
  category: string;
  condition: string;
  currency: string;
  priceMin: string;
  priceMax: string;
  yearMin: string;
  yearMax: string;
  material: string;
  movement: string;
  dialColor: string;
  braceletMaterial: string;
  boxPapers: string;
  featuredOnly: boolean;
  hypeOnly: boolean;
  newOnly: boolean;
};

export const EMPTY_FILTERS: DraftFilters = {
  brand: "",
  status: "all",
  category: "",
  condition: "",
  currency: "",
  priceMin: "",
  priceMax: "",
  yearMin: "",
  yearMax: "",
  material: "",
  movement: "",
  dialColor: "",
  braceletMaterial: "",
  boxPapers: "",
  featuredOnly: false,
  hypeOnly: false,
  newOnly: false,
};

const SECTIONS = [
  { id: "available", label: "Available" },
  { id: "brand", label: "Brand" },
  { id: "collection", label: "Collection" },
  { id: "price", label: "Price" },
  { id: "dialcolor", label: "Dial Colour" },
  { id: "shape", label: "Shape" },
  { id: "boxpaper", label: "Box and Paper" },
  { id: "diameter", label: "Diameter" },
  { id: "material", label: "Material" },
  { id: "movement", label: "Movement" },
  { id: "year", label: "Year" },
];

const CATEGORIES = [
  "Rolex", "Patek Philippe", "Audemars Piguet", "Cartier",
  "Omega", "Richard Mille", "Vacheron Constantin", "Other watches",
];

const CONDITIONS = [
  { value: "unworn", label: "Unworn" },
  { value: "excellent", label: "Excellent" },
  { value: "very_good", label: "Very Good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const MATERIALS = ["Steel", "Gold", "Rose Gold", "White Gold", "Titanium", "Ceramic", "Platinum"];
const MOVEMENTS = ["Automatic", "Manual", "Quartz"];
const DIAL_COLORS = ["Black", "Anthracite", "Blue", "Brown", "Champagne", "Green", "Grey", "Silver", "White", "Mother-of-pearl", "Skeleton"];
const BRACELET_MATERIALS = ["Steel", "Leather", "Rubber", "Gold", "Titanium", "Ceramic"];
const BOX_PAPERS_OPTIONS = [
  { value: "box", label: "Brand box" },
  { value: "papers", label: "Papers" },
  { value: "both", label: "Box & Papers" },
  { value: "none", label: "No box or papers" },
];
const CURRENCIES = ["CHF", "EUR", "USD", "GBP"];

interface FilterWorkspaceProps {
  open: boolean;
  onClose: () => void;
  draft: DraftFilters;
  onChange: (patch: Partial<DraftFilters>) => void;
  onApply: () => void;
  onReset: () => void;
  brands: string[];
  resultCount: number;
}

/* ─── Arrow right SVG (Bucherer "View Results →") ───────────────────────── */
function ArrowRight() {
  return (
    <svg viewBox="0 0 12 11" width="12" height="11" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M6.3657 11L11.8657 5.5L6.3657 0L5.75358 0.612112L10.2086 5.06717H0V5.93283L10.2086 5.93283L5.75358 10.3879L6.3657 11Z" />
    </svg>
  );
}

/* ─── Chevron left SVG (Hide Filter ‹) ──────────────────────────────────── */
function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/* ─── Tile button — Bucherer brand/condition grid cell ───────────────────── */
function Tile({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`buc-fw__tile${active ? " buc-fw__tile--active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

/* ─── Checkbox row — Bucherer availability style ─────────────────────────── */
function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="buc-fw__check-row">
      <span className={`buc-fw__checkbox${checked ? " buc-fw__checkbox--checked" : ""}`} aria-hidden="true">
        {checked && (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M9.9619 14.8107L6.41108 10.7526L5.75258 10L5 10.6585L5.6585 11.4111L9.87371 16.2285L9.9619 16.3293L10.25 16.6585L10.6263 17.0885L11.0026 16.6585L11.2907 16.3293L11.3789 16.2285L19.0941 7.41108L19.7526 6.6585L19 6L18.3415 6.75258L11.2907 14.8107L10.6263 15.57L9.9619 14.8107Z" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        className="buc-fw__checkbox-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="buc-fw__check-label">{label}</span>
    </label>
  );
}

export default function FilterWorkspace({
  open,
  onClose,
  draft,
  onChange,
  onApply,
  onReset,
  brands,
  resultCount,
}: FilterWorkspaceProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("available");
  /* Bucherer: animated vertical progress bar in the rail */
  const [railProgress, setRailProgress] = useState(0);

  /* Lock body scroll */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* Focus trap + Escape */
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  /* IntersectionObserver — track active section + update rail progress bar */
  useEffect(() => {
    if (!open || !contentRef.current) return;
    const sections = contentRef.current.querySelectorAll<HTMLElement>("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-section") ?? "";
            setActiveSection(id);
            const idx = SECTIONS.findIndex((s) => s.id === id);
            if (idx >= 0) {
              setRailProgress(((idx + 1) / SECTIONS.length) * 100);
            }
          }
        }
      },
      { root: contentRef.current, threshold: 0.25 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [open]);

  const scrollToSection = useCallback((id: string) => {
    const el = contentRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!el || !contentRef.current) return;
    contentRef.current.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
    setActiveSection(id);
    const idx = SECTIONS.findIndex((s) => s.id === id);
    if (idx >= 0) setRailProgress(((idx + 1) / SECTIONS.length) * 100);
  }, []);

  if (!open) return null;

  return (
    /* Bucherer: position:fixed, left:0, top:0, bottom:0, width:100%, height:85dvh */
    <div
      className="buc-fw"
      role="dialog"
      aria-modal="true"
      aria-label="Filter watches"
      ref={dialogRef}
    >
      {/* ── Modal body: grid "header / content 1fr / footer" ── */}
      <div className="buc-fw__modal">

        {/* ── Header (grid-area: header) ── */}
        <div className="buc-fw__header">
          <div className="buc-fw__header-inner">
            {/* FILTER label — xs, uppercase, letter-spacing 6xl, width:200px */}
            <div className="buc-fw__header-label-wrap">
              <p className="buc-fw__header-label">Filter</p>
            </div>
            {/* Spacer */}
            <div className="buc-fw__header-spacer" />
            {/* ‹ Hide Filter — sm, inline-flex, align-items center */}
            <a
              href="#"
              className="buc-fw__hide-link"
              onClick={(e) => { e.preventDefault(); onClose(); }}
              aria-label="Hide filter workspace"
            >
              <span className="buc-fw__hide-icon"><ChevronLeft /></span>
              <span>Hide Filter</span>
            </a>
          </div>
        </div>

        {/* ── Sidebar + Content (grid-area: sidebar + content) ── */}
        <div className="buc-fw__body">

          {/* Section navigator rail — Bucherer: vertical line + animated black bar */}
          <nav className="buc-fw__rail" aria-label="Filter sections">
            <div className="buc-fw__rail-inner">
              {/* Static grey track line */}
              <div className="buc-fw__rail-track" aria-hidden="true" />
              {/* Animated progress bar (Bucherer: position:absolute, top:0, left:0, z-index:1, width:1px, background:black) */}
              <div
                className="buc-fw__rail-progress"
                aria-hidden="true"
                style={{ height: `${railProgress}%` }}
              />
              {/* Nav items */}
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`buc-fw__rail-item${activeSection === s.id ? " buc-fw__rail-item--active" : ""}`}
                  onClick={() => scrollToSection(s.id)}
                  aria-current={activeSection === s.id ? "true" : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Scrollable content pane */}
          <div className="buc-fw__content" ref={contentRef}>

            {/* Available */}
            <section data-section="available" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Available</h3>
              </div>
              <div className="buc-fw__check-list">
                <CheckRow
                  label="Online available"
                  checked={draft.status === "available"}
                  onChange={(v) => onChange({ status: v ? "available" : "all" })}
                />
                <CheckRow
                  label="Featured pieces"
                  checked={draft.featuredOnly}
                  onChange={(v) => onChange({ featuredOnly: v })}
                />
                <CheckRow
                  label="New arrivals"
                  checked={draft.newOnly}
                  onChange={(v) => onChange({ newOnly: v })}
                />
                <CheckRow
                  label="Hype pieces"
                  checked={draft.hypeOnly}
                  onChange={(v) => onChange({ hypeOnly: v })}
                />
              </div>
            </section>

            {/* Brand — Bucherer: 2-column grid */}
            <section data-section="brand" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Brand</h3>
              </div>
              <div className="buc-fw__brand-grid">
                {brands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`buc-fw__brand-item${draft.brand === b ? " buc-fw__brand-item--active" : ""}`}
                    onClick={() => onChange({ brand: draft.brand === b ? "" : b })}
                    aria-pressed={draft.brand === b}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </section>

            {/* Collection (Category) — Bucherer: dropdown accordion */}
            <section data-section="collection" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Collection</h3>
              </div>
              <div className="buc-fw__tile-grid">
                {CATEGORIES.map((c) => (
                  <Tile
                    key={c}
                    label={c}
                    active={draft.category === c}
                    onClick={() => onChange({ category: draft.category === c ? "" : c })}
                  />
                ))}
              </div>
            </section>

            {/* Price — Bucherer: MINIMUM / MAXIMUM inputs with border */}
            <section data-section="price" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Price</h3>
              </div>
              <div className="buc-fw__price-row">
                <div className="buc-fw__price-field">
                  <label className="buc-fw__price-label" htmlFor="buc-price-min">MINIMUM</label>
                  <div className="buc-fw__price-input-wrap">
                    <span className="buc-fw__price-currency">{draft.currency || "CHF"}</span>
                    <input
                      id="buc-price-min"
                      className="buc-fw__price-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={draft.priceMin}
                      onChange={(e) => onChange({ priceMin: e.target.value })}
                    />
                  </div>
                </div>
                <span className="buc-fw__price-sep" aria-hidden="true">→</span>
                <div className="buc-fw__price-field">
                  <label className="buc-fw__price-label" htmlFor="buc-price-max">MAXIMUM</label>
                  <div className="buc-fw__price-input-wrap">
                    <span className="buc-fw__price-currency">{draft.currency || "CHF"}</span>
                    <input
                      id="buc-price-max"
                      className="buc-fw__price-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="50,001 +"
                      value={draft.priceMax}
                      onChange={(e) => onChange({ priceMax: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Dial Colour — Bucherer: colour swatch + label row */}
            <section data-section="dialcolor" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Dial Colour</h3>
              </div>
              <div className="buc-fw__check-list buc-fw__check-list--cols">
                {DIAL_COLORS.map((c) => (
                  <CheckRow
                    key={c}
                    label={c}
                    checked={draft.dialColor.toLowerCase() === c.toLowerCase()}
                    onChange={() => onChange({ dialColor: draft.dialColor.toLowerCase() === c.toLowerCase() ? "" : c })}
                  />
                ))}
              </div>
            </section>

            {/* Shape (Condition) */}
            <section data-section="shape" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Condition</h3>
              </div>
              <div className="buc-fw__tile-grid">
                {CONDITIONS.map((c) => (
                  <Tile
                    key={c.value}
                    label={c.label}
                    active={draft.condition === c.value}
                    onClick={() => onChange({ condition: draft.condition === c.value ? "" : c.value })}
                  />
                ))}
              </div>
            </section>

            {/* Box and Paper */}
            <section data-section="boxpaper" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Box and Paper</h3>
              </div>
              <div className="buc-fw__check-list">
                {BOX_PAPERS_OPTIONS.map((o) => (
                  <CheckRow
                    key={o.value}
                    label={o.label}
                    checked={draft.boxPapers === o.value}
                    onChange={(v) => onChange({ boxPapers: v ? o.value : "" })}
                  />
                ))}
              </div>
            </section>

            {/* Diameter (Bracelet) */}
            <section data-section="diameter" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Bracelet</h3>
              </div>
              <div className="buc-fw__check-list buc-fw__check-list--cols">
                {BRACELET_MATERIALS.map((b) => (
                  <CheckRow
                    key={b}
                    label={b}
                    checked={draft.braceletMaterial.toLowerCase() === b.toLowerCase()}
                    onChange={() => onChange({ braceletMaterial: draft.braceletMaterial.toLowerCase() === b.toLowerCase() ? "" : b })}
                  />
                ))}
              </div>
            </section>

            {/* Material */}
            <section data-section="material" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Material</h3>
              </div>
              <div className="buc-fw__check-list buc-fw__check-list--cols">
                {MATERIALS.map((m) => (
                  <CheckRow
                    key={m}
                    label={m}
                    checked={draft.material.toLowerCase() === m.toLowerCase()}
                    onChange={() => onChange({ material: draft.material.toLowerCase() === m.toLowerCase() ? "" : m })}
                  />
                ))}
              </div>
            </section>

            {/* Movement */}
            <section data-section="movement" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Movement</h3>
              </div>
              <div className="buc-fw__check-list">
                {MOVEMENTS.map((m) => (
                  <CheckRow
                    key={m}
                    label={m}
                    checked={draft.movement.toLowerCase() === m.toLowerCase()}
                    onChange={() => onChange({ movement: draft.movement.toLowerCase() === m.toLowerCase() ? "" : m })}
                  />
                ))}
              </div>
            </section>

            {/* Year */}
            <section data-section="year" className="buc-fw__section">
              <div className="buc-fw__section-head">
                <h3 className="buc-fw__section-label">Year</h3>
              </div>
              <div className="buc-fw__check-list buc-fw__check-list--cols">
                {CURRENCIES.map((c) => (
                  <CheckRow
                    key={c}
                    label={c}
                    checked={draft.currency === c}
                    onChange={(v) => onChange({ currency: v ? c : "" })}
                  />
                ))}
              </div>
              <div className="buc-fw__price-row" style={{ marginTop: "1rem" }}>
                <div className="buc-fw__price-field">
                  <label className="buc-fw__price-label" htmlFor="buc-year-min">FROM</label>
                  <div className="buc-fw__price-input-wrap">
                    <input
                      id="buc-year-min"
                      className="buc-fw__price-input buc-fw__price-input--no-prefix"
                      type="text"
                      inputMode="numeric"
                      placeholder="1950"
                      value={draft.yearMin}
                      onChange={(e) => onChange({ yearMin: e.target.value })}
                    />
                  </div>
                </div>
                <span className="buc-fw__price-sep" aria-hidden="true">→</span>
                <div className="buc-fw__price-field">
                  <label className="buc-fw__price-label" htmlFor="buc-year-max">TO</label>
                  <div className="buc-fw__price-input-wrap">
                    <input
                      id="buc-year-max"
                      className="buc-fw__price-input buc-fw__price-input--no-prefix"
                      type="text"
                      inputMode="numeric"
                      placeholder={String(new Date().getFullYear())}
                      value={draft.yearMax}
                      onChange={(e) => onChange({ yearMax: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </section>

          </div>{/* /buc-fw__content */}
        </div>{/* /buc-fw__body */}

        {/* ── Footer / Action bar (grid-area: footer) ── */}
        {/* Bucherer: border-top, px-8, py-8, justify-content:end, full-width button */}
        <div className="buc-fw__footer">
          <div className="buc-fw__footer-inner">
            {/* View Results button — Bucherer: height:53px, full width, uppercase, letter-spacing 5xl */}
            <button
              type="button"
              className="buc-fw__view-results"
              onClick={() => { onApply(); onClose(); }}
            >
              <span className="buc-fw__view-results-text">View Results</span>
              <span className="buc-fw__view-results-icon"><ArrowRight /></span>
            </button>
          </div>
        </div>

      </div>{/* /buc-fw__modal */}
    </div>
  );
}
