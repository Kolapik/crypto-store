import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

export default function ScrollNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [location]);

  // Hide on all admin routes
  if (location.startsWith("/admin")) return null;

  return (
    <>
      <nav className={`nav${scrolled ? " scrolled" : ""}${open ? " menu-open" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <img
              src="/images/vault-watch-sail-symbol.svg"
              alt=""
              className="nav-logo-mark"
              aria-hidden="true"
            />
            Helvetic Reserve
          </Link>

          {/* Desktop links */}
          <ul className="nav-links nav-links--desktop">
            <li><Link href="/catalogue">Catalogue</Link></li>
          </ul>

          {/* Mobile hamburger */}
          <button
            className={`nav-burger${open ? " active" : ""}`}
            onClick={() => setOpen(o => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="nav-drawer" onClick={() => setOpen(false)}>
          <div className="nav-drawer-inner" onClick={e => e.stopPropagation()}>
            <Link href="/" className="nav-drawer-logo">
              <img
                src="/images/vault-watch-sail-symbol.svg"
                alt=""
                className="nav-logo-mark"
                aria-hidden="true"
              />
              Helvetic Reserve
            </Link>
            <ul className="nav-drawer-links">
              <li><Link href="/catalogue" onClick={() => setOpen(false)}>Catalogue</Link></li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
