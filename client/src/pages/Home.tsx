import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import WatchCard from "@/components/WatchCard";
import BrandTicker from "@/components/BrandTicker";

export default function Home() {
  const { data: watches } = trpc.watches.list.useQuery({});
  const featured = (watches ?? []).slice(0, 4);

  return (
    <main>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <img
            src="/manus-storage/ocean-hero_8e855daf.jpg"
            alt="Deep dark ocean"
          />
        </div>
        <div className="hero-content">
          <p className="hero-eyebrow">Private-source catalogue</p>
          <h1>
            <span
              className="glitch-wrap"
              data-text="Selected watches, quietly presented."
            >
              Selected watches,{" "}
              <em>quietly presented.</em>
            </span>
          </h1>
          <p className="hero-lede">
            Browse available pieces, request a watch, and let the owner confirm
            availability before any invoice or payment details are discussed.
          </p>
          <div className="hero-actions">
            <Link href="/catalogue" className="button lg">
              Browse catalogue
            </Link>
            <Link href="/catalogue" className="button secondary lg">
              View collection
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured watches ── */}
      <section className="section page" style={{ paddingTop: "4rem" }}>
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Current edit</p>
            <h2 className="section-title">Available catalogue</h2>
          </div>
          <Link href="/catalogue" className="button secondary">
            View all
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="product-grid">
            {featured.map((watch) => (
              <WatchCard key={watch.id} {...watch} />
            ))}
          </div>
        ) : (
          <div className="notice">No watches available at this time.</div>
        )}
      </section>

      {/* ── Brand ticker ── */}
      <BrandTicker />
    </main>
  );
}
