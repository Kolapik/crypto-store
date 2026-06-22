import { Link, useLocation } from "wouter";

export default function SiteFooter() {
  const [location] = useLocation();

  if (location.startsWith("/admin")) return null;

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-brand">
          Helvetic Reserve
        </p>
        <nav className="site-footer-links" aria-label="Footer navigation">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:contact@helvetic-reserve.com">Contact</a>
          <Link href="/admin/login">Log in</Link>
        </nav>
      </div>
    </footer>
  );
}
