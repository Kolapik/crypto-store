const BRANDS = [
  "Rolex", "Patek Philippe", "Audemars Piguet", "IWC",
  "Jaeger-LeCoultre", "Vacheron Constantin", "A. Lange & Söhne",
  "Breguet", "Panerai", "Hublot", "TAG Heuer", "Omega",
  "Breitling", "Cartier", "Richard Mille",
];

export default function BrandTicker() {
  const items = [...BRANDS, ...BRANDS];
  return (
    <div className="brand-ticker" aria-hidden="true">
      <div className="brand-ticker-crt" />
      <div className="brand-ticker-track">
        {items.map((brand, i) => (
          <span key={i} className="brand-ticker-item">
            {brand}
            <span className="brand-ticker-sep">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
