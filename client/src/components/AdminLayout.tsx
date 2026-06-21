import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_GROUPS = [
  {
    label: "Operate",
    links: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "⬡" },
      { href: "/admin/watches", label: "Catalogue", icon: "◎" },
      { href: "/admin/requests", label: "Requests", icon: "◈" },
    ],
  },
  {
    label: "Configure",
    links: [
      { href: "/admin/pricing", label: "Pricing", icon: "◇" },
    ],
  },
  {
    label: "Maintain",
    links: [
      { href: "/admin/audit", label: "Audit log", icon: "◉" },
      { href: "/admin/health", label: "System health", icon: "◌" },
    ],
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => navigate("/admin/login"),
  });

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "A";

  return (
    <div className="admin-shell">
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <p className="wordmark">Vault<span>.</span>Watch</p>
          <p className="admin-brand-tag">Control panel</p>
        </div>

        {/* User chip */}
        <div className="admin-user">
          <div className="admin-user-avatar">{initials}</div>
          <div className="admin-user-meta">
            <span className="admin-user-name">{user?.name ?? "Owner"}</span>
            <span className="admin-user-role">Admin</span>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="admin-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="admin-nav-group">
              <p className="admin-nav-label">{group.label}</p>
              {group.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={location === link.href || location.startsWith(link.href + "/") ? "active" : ""}
                >
                  <span style={{ fontSize: "0.9rem", lineHeight: 1 }}>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="admin-sidebar-footer">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <span>↗</span> View live site
          </a>
          <button onClick={() => logoutMutation.mutate()}>
            <span>→</span> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
