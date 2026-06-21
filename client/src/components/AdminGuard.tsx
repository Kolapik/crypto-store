import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface Props {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: Props) {
  const { isAuthenticated, user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        navigate("/admin/login");
      } else if (user?.role !== "admin") {
        navigate("/admin/login");
      }
    }
  }, [isAuthenticated, user, loading, navigate]);

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Verifying access…</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") return null;

  return <>{children}</>;
}
