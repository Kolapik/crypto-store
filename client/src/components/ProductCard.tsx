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

/* ─── Heart SVG (Bucherer-style thin stroke) ─────────────────────────────── */
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function ProductCard({
  id,
  brand,
  model,
  title,
  reference,
  year,
  condition,
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
  const displayName = title || model;

  const formattedPrice = price
    ? `${currency ?? "CHF"} ${Number(price).toLocaleString("de-CH")}`
    : null;

  function handleFavourite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavoured((v) => !v);
    onFavouriteToggle?.(id);
  }

  return (
    /* Bucherer card: no border, no card bg — just the image + text below */
    <Link
      href={`/watches/${slug}`}
      className="buc-card"
      aria-label={`${brand} ${displayName}`}
    >
      {/* ── Media stage: exact 3/4 aspect ratio, overflow hidden ── */}
      <div className="buc-card__media">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${brand} ${displayName}`}
            loading="lazy"
            className="buc-card__img"
          />
        ) : (
          /* Placeholder with ocean teal tint + hash — mirrors Bucherer's #F1EBE5 bg */
          <div className="buc-card__placeholder" aria-hidden="true">
            <div className="buc-card__placeholder-icon">
              {/* Watch outline */}
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="12" cy="12" r="7" />
                <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" />
                <path d="M12 9v3l2 2" />
              </svg>
            </div>
            <span className="buc-card__hash">0x{hash}</span>
          </div>
        )}

        {/* CRT pixel-grid overlay — ocean CRT vibe */}
        <div className="buc-card__crt" aria-hidden="true" />

        {/* Badges — top-left, same position as Bucherer */}
        {(newArrival || hype) && (
          <div className="buc-card__badges">
            {newArrival && <span className="buc-badge buc-badge--new">New</span>}
            {hype && <span className="buc-badge buc-badge--hype">Hype</span>}
          </div>
        )}

        {/* Favourite button — top-right, same as Bucherer */}
        <button
          className={`buc-card__fav${favoured ? " buc-card__fav--active" : ""}`}
          onClick={handleFavourite}
          aria-label={
            favoured
              ? `Remove ${brand} ${displayName} from favourites`
              : `Add ${brand} ${displayName} to favourites`
          }
          aria-pressed={favoured}
        >
          <HeartIcon filled={favoured} />
        </button>
      </div>

      {/* ── Text body: Bucherer spacing — pt-4 (8px), gap between rows ── */}
      <div className="buc-card__body">
        {/* Brand — xs, uppercase, letter-spacing 6xl (0.1em) */}
        <p className="buc-card__brand">{brand}</p>

        {/* Model name — sm, weight 500, no text-transform */}
        <p className="buc-card__model">{displayName}</p>

        {/* Price row */}
        <div className="buc-card__price-row">
          {formattedPrice ? (
            <span className="buc-card__price">{formattedPrice}</span>
          ) : (
            <span className="buc-card__price buc-card__price--request">Price on request</span>
          )}
          {status === "available" && (
            <span className="buc-card__stock">
              <span className="buc-card__stock-dot" aria-hidden="true" />
              In stock
            </span>
          )}
          {status === "reserved" && (
            <span className="buc-card__stock buc-card__stock--reserved">On request</span>
          )}
          {status === "sold" && (
            <span className="buc-card__stock buc-card__stock--sold">Sold</span>
          )}
        </div>

        {/* Reference / year / condition — monospace, muted */}
        {(reference || year || condLabel) && (
          <p className="buc-card__meta">
            {[reference, year, condLabel].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </Link>
  );
}

/* ─── Skeleton loader (same 3/4 media + body proportions) ────────────────── */
export function ProductCardSkeleton() {
  return (
    <div className="buc-card-skeleton" aria-hidden="true">
      <div className="buc-card-skeleton__media" />
      <div className="buc-card-skeleton__body">
        <div className="buc-card-skeleton__line buc-card-skeleton__line--short" />
        <div className="buc-card-skeleton__line buc-card-skeleton__line--med" />
        <div className="buc-card-skeleton__line buc-card-skeleton__line--short" />
      </div>
    </div>
  );
}
