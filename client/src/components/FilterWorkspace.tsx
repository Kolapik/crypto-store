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
  { id: "availability", label: "Availability" },
  { id: "brand", label: "Brand" },
  { id: "category", label: "Category" },
  { id: "condition", label: "Condition" },
  { id: "price", label: "Price" },
  { id: "year", label: "Year" },
  { id: "material", label: "Material" },
  { id: "movement", label: "Movement" },
  { id: "dialcolor", label: "Dial Colour" },
  { id: "bracelet", label: "Bracelet" },
  { id: "boxpapers", label: "Box & Papers" },
  { id: "currency", label: "Currency" },
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
const MOVEMENTS = ["Automatic", "Manual", "Quartz", "Solar"];
const DIAL_COLORS = ["Black", "Blue", "White", "Silver", "Grey", "Green", "Brown", "Champagne", "Mother-of-pearl", "Skeleton"];
const BRACELET_MATERIALS = ["Steel", "Leather", "Rubber", "Gold", "Titanium", "Ceramic"];
const BOX_PAPERS_OPTIONS = ["Box included", "Papers included", "Box & Papers", "No box or papers"];
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

function TileButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`fw-tile${active ? " fw-tile-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("availability");

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Focus trap and Escape key
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

  // IntersectionObserver to track active section
  useEffect(() => {
    if (!open || !contentRef.current) return;
    const sections = contentRef.current.querySelectorAll<HTMLElement>("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.getAttribute("data-section") ?? "");
          }
        }
      },
      { root: contentRef.current, threshold: 0.3 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [open]);

  const scrollToSection = useCallback((id: string) => {
    const el = contentRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!el || !contentRef.current) return;
    const offset = el.offsetTop - 16;
    contentRef.current.scrollTo({ top: offset, behavior: "smooth" });
    setActiveSection(id);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fw-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Filter watches"
      ref={dialogRef}
    >
      {/* Top bar */}
      <div className="fw-topbar">
        <span className="fw-topbar-label">FILTER</span>
        <button className="fw-close" onClick={onClose} aria-label="Hide filter workspace">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Hide Filter</span>
        </button>
      </div>

      {/* Body */}
      <div className="fw-body">
        {/* Section navigator (desktop) */}
        <nav className="fw-rail" aria-label="Filter sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`fw-rail-item${activeSection === s.id ? " fw-rail-item-active" : ""}`}
              onClick={() => scrollToSection(s.id)}
              aria-current={activeSection === s.id ? "true" : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Scrollable content pane */}
        <div className="fw-content" ref={contentRef}>

          {/* Availability */}
          <section data-section="availability" className="fw-section">
            <h3 className="fw-section-label">Availability</h3>
            <label className="fw-check-row">
              <input
                type="checkbox"
                className="fw-checkbox"
                checked={draft.status === "available"}
                onChange={(e) => onChange({ status: e.target.checked ? "available" : "all" })}
              />
              <span>In stock only</span>
            </label>
            <label className="fw-check-row">
              <input
                type="checkbox"
                className="fw-checkbox"
                checked={draft.featuredOnly}
                onChange={(e) => onChange({ featuredOnly: e.target.checked })}
              />
              <span>Featured pieces</span>
            </label>
            <label className="fw-check-row">
              <input
                type="checkbox"
                className="fw-checkbox"
                checked={draft.newOnly}
                onChange={(e) => onChange({ newOnly: e.target.checked })}
              />
              <span>New arrivals</span>
            </label>
            <label className="fw-check-row">
              <input
                type="checkbox"
                className="fw-checkbox"
                checked={draft.hypeOnly}
                onChange={(e) => onChange({ hypeOnly: e.target.checked })}
              />
              <span>Hype pieces</span>
            </label>
          </section>

          {/* Brand */}
          <section data-section="brand" className="fw-section">
            <h3 className="fw-section-label">Brand</h3>
            <div className="fw-tile-grid">
              {brands.map((b) => (
                <TileButton
                  key={b}
                  label={b}
                  active={draft.brand === b}
                  onClick={() => onChange({ brand: draft.brand === b ? "" : b })}
                />
              ))}
            </div>
          </section>

          {/* Category */}
          <section data-section="category" className="fw-section">
            <h3 className="fw-section-label">Category</h3>
            <div className="fw-tile-grid">
              {CATEGORIES.map((c) => (
                <TileButton
                  key={c}
                  label={c}
                  active={draft.category === c}
                  onClick={() => onChange({ category: draft.category === c ? "" : c })}
                />
              ))}
            </div>
          </section>

          {/* Condition */}
          <section data-section="condition" className="fw-section">
            <h3 className="fw-section-label">Condition</h3>
            <div className="fw-tile-grid">
              {CONDITIONS.map((c) => (
                <TileButton
                  key={c.value}
                  label={c.label}
                  active={draft.condition === c.value}
                  onClick={() => onChange({ condition: draft.condition === c.value ? "" : c.value })}
                />
              ))}
            </div>
          </section>

          {/* Price */}
          <section data-section="price" className="fw-section">
            <h3 className="fw-section-label">Price</h3>
            <div className="fw-price-row">
              <div className="fw-price-field">
                <label className="fw-price-label" htmlFor="fw-price-min">Minimum</label>
                <input
                  id="fw-price-min"
                  className="fw-price-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={draft.priceMin}
                  onChange={(e) => onChange({ priceMin: e.target.value })}
                />
              </div>
              <span className="fw-price-sep">—</span>
              <div className="fw-price-field">
                <label className="fw-price-label" htmlFor="fw-price-max">Maximum</label>
                <input
                  id="fw-price-max"
                  className="fw-price-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Any"
                  value={draft.priceMax}
                  onChange={(e) => onChange({ priceMax: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* Year */}
          <section data-section="year" className="fw-section">
            <h3 className="fw-section-label">Year</h3>
            <div className="fw-price-row">
              <div className="fw-price-field">
                <label className="fw-price-label" htmlFor="fw-year-min">From</label>
                <input
                  id="fw-year-min"
                  className="fw-price-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="1950"
                  value={draft.yearMin}
                  onChange={(e) => onChange({ yearMin: e.target.value })}
                />
              </div>
              <span className="fw-price-sep">—</span>
              <div className="fw-price-field">
                <label className="fw-price-label" htmlFor="fw-year-max">To</label>
                <input
                  id="fw-year-max"
                  className="fw-price-input"
                  type="text"
                  inputMode="numeric"
                  placeholder={String(new Date().getFullYear())}
                  value={draft.yearMax}
                  onChange={(e) => onChange({ yearMax: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* Material */}
          <section data-section="material" className="fw-section">
            <h3 className="fw-section-label">Material</h3>
            <div className="fw-tile-grid">
              {MATERIALS.map((m) => (
                <TileButton
                  key={m}
                  label={m}
                  active={draft.material.toLowerCase() === m.toLowerCase()}
                  onClick={() => onChange({ material: draft.material.toLowerCase() === m.toLowerCase() ? "" : m })}
                />
              ))}
            </div>
          </section>

          {/* Movement */}
          <section data-section="movement" className="fw-section">
            <h3 className="fw-section-label">Movement</h3>
            <div className="fw-tile-grid">
              {MOVEMENTS.map((m) => (
                <TileButton
                  key={m}
                  label={m}
                  active={draft.movement.toLowerCase() === m.toLowerCase()}
                  onClick={() => onChange({ movement: draft.movement.toLowerCase() === m.toLowerCase() ? "" : m })}
                />
              ))}
            </div>
          </section>

          {/* Dial Colour */}
          <section data-section="dialcolor" className="fw-section">
            <h3 className="fw-section-label">Dial Colour</h3>
            <div className="fw-tile-grid">
              {DIAL_COLORS.map((c) => (
                <TileButton
                  key={c}
                  label={c}
                  active={draft.dialColor.toLowerCase() === c.toLowerCase()}
                  onClick={() => onChange({ dialColor: draft.dialColor.toLowerCase() === c.toLowerCase() ? "" : c })}
                />
              ))}
            </div>
          </section>

          {/* Bracelet */}
          <section data-section="bracelet" className="fw-section">
            <h3 className="fw-section-label">Bracelet</h3>
            <div className="fw-tile-grid">
              {BRACELET_MATERIALS.map((b) => (
                <TileButton
                  key={b}
                  label={b}
                  active={draft.braceletMaterial.toLowerCase() === b.toLowerCase()}
                  onClick={() => onChange({ braceletMaterial: draft.braceletMaterial.toLowerCase() === b.toLowerCase() ? "" : b })}
                />
              ))}
            </div>
          </section>

          {/* Box & Papers */}
          <section data-section="boxpapers" className="fw-section">
            <h3 className="fw-section-label">Box &amp; Papers</h3>
            <div className="fw-tile-grid">
              {BOX_PAPERS_OPTIONS.map((o) => (
                <TileButton
                  key={o}
                  label={o}
                  active={draft.boxPapers === o}
                  onClick={() => onChange({ boxPapers: draft.boxPapers === o ? "" : o })}
                />
              ))}
            </div>
          </section>

          {/* Currency */}
          <section data-section="currency" className="fw-section">
            <h3 className="fw-section-label">Currency</h3>
            <div className="fw-tile-grid">
              {CURRENCIES.map((c) => (
                <TileButton
                  key={c}
                  label={c}
                  active={draft.currency === c}
                  onClick={() => onChange({ currency: draft.currency === c ? "" : c })}
                />
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Action bar */}
      <div className="fw-actionbar">
        <button type="button" className="fw-reset" onClick={onReset}>
          Reset all
        </button>
        <button type="button" className="fw-apply" onClick={onApply}>
          View Results
          {resultCount > 0 && (
            <span className="fw-apply-count">{resultCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}
