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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <p className="auth-wordmark">Vault<span>.</span>Watch</p>
          <p className="auth-subtitle">Admin access</p>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <a href={loginUrl} className="button lg" style={{ textAlign: "center", display: "block" }}>
            {loading ? "Checking session…" : "Sign in with Manus"}
          </a>
        </div>

        <p style={{ marginTop: "1.25rem", fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          Admin access is restricted to the platform owner.
        </p>

        <a href="/" className="auth-back">← Back to catalogue</a>
      </div>
    </div>
  );
}
