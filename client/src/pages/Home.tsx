import { Link } from "wouter";
import { useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import WatchCard from "@/components/WatchCard";
import BrandTicker from "@/components/BrandTicker";

function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!isDragging.current || !el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.2;
    el.scrollLeft = scrollLeft.current - walk;
  }, []);

  const onMouseUp = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    isDragging.current = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    isDragging.current = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  }, []);

  return { ref, onMouseDown, onMouseMove, onMouseUp, onMouseLeave };
}

export default function Home() {
  const { data: watches } = trpc.watches.list.useQuery({});
  const featured = (watches ?? []).slice(0, 6);
  const drag = useDragScroll();

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

      {/* ── Brand ticker ── */}
      <BrandTicker />

      {/* ── New Arrivals ── */}
      <section className="arrivals-section">
        <div className="arrivals-header">
          <h2 className="arrivals-title">New Arrivals</h2>
          <Link href="/catalogue" className="button secondary">
            View all
          </Link>
        </div>

        {featured.length > 0 ? (
          <div
            className="arrivals-scroll"
            ref={drag.ref}
            onMouseDown={drag.onMouseDown}
            onMouseMove={drag.onMouseMove}
            onMouseUp={drag.onMouseUp}
            onMouseLeave={drag.onMouseLeave}
          >
            {featured.map((watch) => (
              <div className="arrivals-item" key={watch.id}>
                <WatchCard {...watch} />
              </div>
            ))}
          </div>
        ) : (
          <div className="notice" style={{ padding: "0 var(--page-px)" }}>
            No watches available at this time.
          </div>
        )}
      </section>
    </main>
  );
}
