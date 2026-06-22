import { useState } from "react";
import { Link } from "wouter";

interface ProductCardProps {
  id: number;
  brand: string;
  model: string;
  title?: string | null;
  reference?: string | null;
  year?: number | null;
  condition?: string | null;
  category?: string | null;
  hype?: boolean | null;
  newArrival?: boolean | null;
  price?: string | null;
  currency?: string | null;
  status: string;
  imageUrl?: string | null;
  slug: string;
  isFavourite?: boolean;
  onFavouriteToggle?: (id: number) => void;
}

const CONDITION_LABELS: Record<string, string> = {
  unworn: "Unworn",
  excellent: "Excellent",
  very_good: "Very Good",
  good: "Good",
  fair: "Fair",
};

function hashFromSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (Math.imul(31, h) + slug.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, "0").toUpperCase();
}

export default function ProductCard({
  id,
  brand,
  model,
  title,
  reference,
  year,
  condition,
  category,
  hype,
  newArrival,
  price,
  currency,
  status,
  imageUrl,
  slug,
  isFavourite = false,
  onFavouriteToggle,
}: ProductCardProps) {
  const [favoured, setFavoured] = useState(isFavourite);
  const hash = hashFromSlug(slug);
  const condLabel = condition ? CONDITION_LABELS[condition] ?? condition : null;
  const isAvailable = status === "available";

  function handleFavourite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavoured((v) => !v);
    onFavouriteToggle?.(id);
  }

  const formattedPrice = price
    ? `${currency ?? "CHF"} ${Number(price).toLocaleString("de-CH")}`
    : "Price on request";

  return (
    <Link href={`/watches/${slug}`} className="pc-card" aria-label={`${brand} ${title || model}`}>
      {/* Media stage */}
      <div className="pc-media">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${brand} ${model}`}
            loading="lazy"
            className="pc-media-img"
          />
        ) : (
          <div className="pc-media-placeholder" aria-hidden="true">
            <div className="pc-media-placeholder-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="12" cy="12" r="7" />
                <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" />
                <path d="M12 9v3l2 2" />
              </svg>
            </div>
            <span className="pc-media-hash">0x{hash}</span>
          </div>
        )}
        {/* CRT pixel-grid overlay */}
        <div className="pc-media-crt" aria-hidden="true" />
        {/* Badges */}
        {(hype || newArrival) && (
          <div className="pc-badges">
            {newArrival && <span className="pc-badge pc-badge-new">New</span>}
            {hype && <span className="pc-badge pc-badge-hype">Hype</span>}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="pc-body">
        <div className="pc-body-top">
          <div className="pc-body-left">
            <p className="pc-brand">{brand}</p>
            <p className="pc-model">{title || model}</p>
          </div>
          <button
            className={`pc-fav${favoured ? " pc-fav-active" : ""}`}
            onClick={handleFavourite}
            aria-label={favoured ? `Remove ${brand} ${model} from favourites` : `Add ${brand} ${model} to favourites`}
            aria-pressed={favoured}
            tabIndex={0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={favoured ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        <div className="pc-body-bottom">
          <div className="pc-price-row">
            <p className="pc-price">{formattedPrice}</p>
            {isAvailable && (
              <span className="pc-stock">
                <span className="pc-stock-dot" aria-hidden="true" />
                In stock
              </span>
            )}
            {status === "reserved" && (
              <span className="pc-stock pc-stock-reserved">On request</span>
            )}
            {status === "sold" && (
              <span className="pc-stock pc-stock-sold">Sold</span>
            )}
          </div>
          {(reference || year || condLabel) && (
            <p className="pc-meta">
              {[reference, year, condLabel].filter(Boolean).join(" · ")}
            </p>
          )}
          {category && category !== brand && (
            <p className="pc-category">{category}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
