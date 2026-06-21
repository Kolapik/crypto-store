import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

export default function ScrollNav() {
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hide on all admin routes
  if (location.startsWith("/admin")) return null;

  return (
    <nav className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          Vault<span>.</span>Watch
        </Link>
        <ul className="nav-links">
          <li><Link href="/catalogue">Catalogue</Link></li>
          <li><Link href="/admin/login" className="nav-cta">Log in</Link></li>
        </ul>
      </div>
    </nav>
  );
}
