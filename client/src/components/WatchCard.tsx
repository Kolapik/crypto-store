import { useState } from "react";
import { Link } from "wouter";

interface WatchCardProps {
  id: number;
  brand: string;
  model: string;
  title?: string | null;
  reference?: string | null;
  year?: number | null;
  condition?: string | null;
  category?: string | null;
  price?: string | null;
  currency?: string | null;
  imageUrl?: string | null;
  slug: string;
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

export default function WatchCard({ brand, model, title, reference, year, condition, category, price, currency, imageUrl, slug }: WatchCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const hash = hashFromSlug(slug);
  const condLabel = condition ? CONDITION_LABELS[condition] ?? condition : null;
  const showImage = Boolean(imageUrl && !imageFailed);

  return (
    <Link href={`/watches/${slug}`} className="watch-card">
      <div className="watch-card-image">
        {showImage ? (
          <img src={imageUrl ?? ""} alt={`${brand} ${model}`} loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <div className="watch-card-placeholder">
            <div className="watch-card-placeholder-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="7" />
                <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" />
                <path d="M12 9v3l2 2" />
              </svg>
            </div>
            <span className="watch-card-placeholder-hash">0x{hash}</span>
          </div>
        )}
      </div>
      <div className="watch-card-body">
        <p className="watch-card-brand">{category ?? brand}</p>
        <p className="watch-card-model">{title || model}</p>
        <p className="watch-card-meta">
          {[reference, year, condLabel].filter(Boolean).join(" · ")}
        </p>
        <p className="watch-card-price">
          {price ? `${currency ?? "CHF"} ${Number(price).toLocaleString("de-CH")}` : "Price on request"}
        </p>
      </div>
    </Link>
  );
}
