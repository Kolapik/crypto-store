import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const { isAuthenticated, user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role === "admin") {
      navigate("/admin/dashboard");
    }
  }, [isAuthenticated, user, loading, navigate]);

  const loginUrl = getLoginUrl();
  const fallbackLoginUrl = isAuthenticated && user?.role === "admin"
    ? "/admin/dashboard"
    : "/admin/dashboard";
  const buttonUrl = loginUrl ?? fallbackLoginUrl;
  const buttonLabel = loading
    ? "Checking session…"
    : loginUrl
      ? "Sign in with Manus"
      : "Open local admin preview";

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <p className="auth-wordmark">Helvetic Reserve</p>
          <p className="auth-subtitle">Admin access</p>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <a href={buttonUrl} className="button lg" style={{ textAlign: "center", display: "block" }}>
            {buttonLabel}
          </a>
        </div>

        <p style={{ marginTop: "1.25rem", fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          Admin access is restricted to Helvetic Reserve operators.
        </p>

        <a href="/" className="auth-back">← Back to catalogue</a>
      </div>
    </div>
  );
}
