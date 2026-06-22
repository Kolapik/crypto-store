import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { type FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const { isAuthenticated, user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role === "admin") {
      navigate("/admin/dashboard");
    }
  }, [isAuthenticated, user, loading, navigate]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/admin/dashboard");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const busy = loading || loginMutation.isPending;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <p className="auth-wordmark">Helvetic Reserve</p>
          <p className="auth-subtitle">Admin access</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            className="form-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="form-label" htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {loginMutation.error ? (
            <p className="auth-error">{loginMutation.error.message}</p>
          ) : null}

          <button className="button lg" type="submit" disabled={busy}>
            {busy ? "Checking access..." : "Log in"}
          </button>
        </form>

        <p style={{ marginTop: "1.25rem", fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          Admin access is restricted to Helvetic Reserve operators.
        </p>

        <a href="/" className="auth-back">← Back to home</a>
      </div>
    </div>
  );
}
