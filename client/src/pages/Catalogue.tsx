import { useState } from "react";
import { trpc } from "@/lib/trpc";
import WatchCard from "@/components/WatchCard";

const CATEGORIES = [
  "Rolex",
  "Patek Philippe",
  "Audemars Piguet",
  "Cartier",
  "Omega",
  "Richard Mille",
  "Vacheron Constantin",
  "Other watches",
];

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export default function Catalogue() {
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [currency, setCurrency] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [material, setMaterial] = useState("");
  const [movement, setMovement] = useState("");
  const [dialColor, setDialColor] = useState("");
  const [braceletMaterial, setBraceletMaterial] = useState("");
  const [boxPapers, setBoxPapers] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [hypeOnly, setHypeOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [sort, setSort] = useState("featured");

  const { data: watches, isLoading } = trpc.watches.list.useQuery({
    brand: brand || undefined,
    status,
    search: search || undefined,
    category: category || undefined,
    condition: condition || undefined,
    currency: currency || undefined,
    priceMin: numberOrUndefined(priceMin),
    priceMax: numberOrUndefined(priceMax),
    yearMin: numberOrUndefined(yearMin),
    yearMax: numberOrUndefined(yearMax),
    material: material || undefined,
    movement: movement || undefined,
    dialColor: dialColor || undefined,
    braceletMaterial: braceletMaterial || undefined,
    boxPapers: boxPapers || undefined,
    featured: featuredOnly || undefined,
    hype: hypeOnly || undefined,
    newArrival: newOnly || undefined,
    sort,
  });
  const { data: brands } = trpc.watches.brands.useQuery();

  const hasFilters = Boolean(
    brand ||
      status !== "all" ||
      search ||
      category ||
      condition ||
      currency ||
      priceMin ||
      priceMax ||
      yearMin ||
      yearMax ||
      material ||
      movement ||
      dialColor ||
      braceletMaterial ||
      boxPapers ||
      featuredOnly ||
      hypeOnly ||
      newOnly ||
      sort !== "featured",
  );

  const clearFilters = () => {
    setBrand("");
    setStatus("all");
    setSearch("");
    setCategory("");
    setCondition("");
    setCurrency("");
    setPriceMin("");
    setPriceMax("");
    setYearMin("");
    setYearMax("");
    setMaterial("");
    setMovement("");
    setDialColor("");
    setBraceletMaterial("");
    setBoxPapers("");
    setFeaturedOnly(false);
    setHypeOnly(false);
    setNewOnly(false);
    setSort("featured");
  };

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

        <div className="filter-toolbar">
          <div className="filter-toolbar-controls">
            <input
              className="filter-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search brand, model, reference"
            />
            <select className="filter-select" value={brand} onChange={(event) => setBrand(event.target.value)}>
              <option value="">All brands</option>
              {(brands ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Available on request</option>
              <option value="sold">Sold</option>
            </select>
            <select className="filter-select" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="featured">Featured first</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price low to high</option>
              <option value="price_desc">Price high to low</option>
              <option value="brand_az">Brand A-Z</option>
            </select>
            {hasFilters && <button className="button ghost sm" onClick={clearFilters}>Clear</button>}
          </div>
          <span className="filter-count">{watches?.length ?? 0} piece{watches?.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="filter-advanced">
          <select className="filter-select" value={condition} onChange={(event) => setCondition(event.target.value)}>
            <option value="">Any condition</option>
            <option value="unworn">Unworn</option>
            <option value="excellent">Excellent</option>
            <option value="very_good">Very Good</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
          </select>
          <select className="filter-select" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            <option value="">Any currency</option>
            <option value="CHF">CHF</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
          <input className="filter-input small" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} placeholder="Min price" inputMode="numeric" />
          <input className="filter-input small" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} placeholder="Max price" inputMode="numeric" />
          <input className="filter-input small" value={yearMin} onChange={(event) => setYearMin(event.target.value)} placeholder="Min year" inputMode="numeric" />
          <input className="filter-input small" value={yearMax} onChange={(event) => setYearMax(event.target.value)} placeholder="Max year" inputMode="numeric" />
          <input className="filter-input" value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Material" />
          <input className="filter-input" value={movement} onChange={(event) => setMovement(event.target.value)} placeholder="Movement" />
          <input className="filter-input" value={dialColor} onChange={(event) => setDialColor(event.target.value)} placeholder="Dial color" />
          <input className="filter-input" value={braceletMaterial} onChange={(event) => setBraceletMaterial(event.target.value)} placeholder="Bracelet" />
          <input className="filter-input" value={boxPapers} onChange={(event) => setBoxPapers(event.target.value)} placeholder="Box / papers" />
          <label className="filter-toggle">
            <input type="checkbox" checked={featuredOnly} onChange={(event) => setFeaturedOnly(event.target.checked)} />
            <span>Featured</span>
          </label>
          <label className="filter-toggle">
            <input type="checkbox" checked={hypeOnly} onChange={(event) => setHypeOnly(event.target.checked)} />
            <span>Hype</span>
          </label>
          <label className="filter-toggle">
            <input type="checkbox" checked={newOnly} onChange={(event) => setNewOnly(event.target.checked)} />
            <span>New</span>
          </label>
        </div>

        {isLoading ? (
          <div className="notice">Loading catalogue...</div>
        ) : watches && watches.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mt-8">
            {watches.map((watch) => <WatchCard key={watch.id} {...watch} />)}
          </div>
        ) : (
          <div className="notice">No watches match the selected filters.</div>
        )}
      </div>
    </main>
  );
}
