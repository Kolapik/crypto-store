import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
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
      { href: "/admin/import", label: "Import", icon: "◇" },
      { href: "/admin/suppliers", label: "Fournisseurs", icon: "◫" },
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

function SidebarContent({
  user, location, onNavigate, onLogout
}: {
  user: { name?: string | null } | null | undefined;
  location: string;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "A";

  return (
    <>
      <div className="admin-brand">
        <p className="wordmark">Helvetic Reserve</p>
        <p className="admin-brand-tag">Control panel</p>
      </div>

      <div className="admin-user">
        <div className="admin-user-avatar">{initials}</div>
        <div className="admin-user-meta">
          <span className="admin-user-name">{user?.name ?? "Owner"}</span>
          <span className="admin-user-role">Admin</span>
        </div>
      </div>

      <nav className="admin-nav">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="admin-nav-group">
            <p className="admin-nav-label">{group.label}</p>
            {group.links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={location === link.href || location.startsWith(link.href + "/") ? "active" : ""}
                onClick={onNavigate}
              >
                <span style={{ fontSize: "0.9rem", lineHeight: 1 }}>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <a href="/" target="_blank" rel="noopener noreferrer">
          <span>↗</span> View live site
        </a>
        <button onClick={onLogout}>
          <span>→</span> Sign out
        </button>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => navigate("/admin/login"),
  });

  // Find current page label for mobile topbar
  const currentLabel = NAV_GROUPS.flatMap(g => g.links).find(
    l => location === l.href || location.startsWith(l.href + "/")
  )?.label ?? "Admin";

  return (
    <div className="admin-shell">
      {/* ── Desktop Sidebar ── */}
      <aside className="admin-sidebar">
        <SidebarContent
          user={user}
          location={location}
          onNavigate={() => {}}
          onLogout={() => logoutMutation.mutate()}
        />
      </aside>

      {/* ── Mobile Topbar ── */}
      <div className="admin-topbar">
        <button
          className="admin-topbar-burger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <span /><span /><span />
        </button>
        <span className="admin-topbar-title">
          Helvetic Reserve
        </span>
        <span className="admin-topbar-page">{currentLabel}</span>
      </div>

      {/* ── Mobile Drawer Overlay ── */}
      {mobileOpen && (
        <div className="admin-drawer-overlay" onClick={() => setMobileOpen(false)}>
          <aside
            className="admin-drawer"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="admin-drawer-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              ✕
            </button>
            <SidebarContent
              user={user}
              location={location}
              onNavigate={() => setMobileOpen(false)}
              onLogout={() => { logoutMutation.mutate(); setMobileOpen(false); }}
            />
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
