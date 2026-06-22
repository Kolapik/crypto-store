import { Link } from "wouter";

export default function Confirmation() {
  return (
    <main style={{ paddingTop: "var(--nav-h)" }}>
      <div className="confirm-page">
        <div className="confirm-card">
          <div className="confirm-icon">✓</div>
          <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "0.75rem" }}>
            Request received
          </p>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 300, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 1rem" }}>
            We'll be in touch
          </h1>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "2rem", fontSize: "0.95rem" }}>
            Your request has been received. If you completed a BTCPay checkout, Helvetic Reserve will verify the signed payment notification before confirming the order. Availability, compliance, delivery, and fulfilment are still manually reviewed.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/catalogue" className="button">
              Browse catalogue
            </Link>
            <Link href="/" className="button secondary">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
