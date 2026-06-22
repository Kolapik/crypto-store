export default function PrivacyPolicy() {
  return (
    <main style={{ paddingTop: "var(--nav-h)" }}>
      <div className="section page" style={{ maxWidth: 900, margin: "0 auto" }}>
        <p className="section-eyebrow">Helvetic Reserve</p>
        <h1 className="section-title">Privacy Policy</h1>
        <p className="section-lede">
          Operational draft for helvetic-reserve.com. Final legal review is still required before production launch.
        </p>

        <div style={{ display: "grid", gap: "1.25rem", color: "var(--text-secondary)", lineHeight: 1.7, marginTop: "2rem" }}>
          <section>
            <h2 className="admin-table-title">Data we collect</h2>
            <p>
              Helvetic Reserve may collect name, email, phone or WhatsApp details, country, billing and shipping details, watch interest, request messages, preferred payment method, wallet address, transaction hash, KYC documents, compliance notes, and communications.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">How we use data</h2>
            <p>
              Data is used to process watch requests, confirm availability, run compliance and KYC checks, prevent fraud, provide support, coordinate delivery, keep accounting records, meet legal obligations, and protect website security.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">Sharing</h2>
            <p>
              Data may be shared with service providers, delivery providers, compliance or payment-related partners, IT hosting providers, legal and accounting advisers, or authorities where necessary. Supplier-private and internal sourcing data is not public customer data.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">Retention and rights</h2>
            <p>
              Data is retained as long as needed for requests, compliance, accounting, dispute handling, and legal obligations. Customers may contact Helvetic Reserve to request access, correction, or deletion where applicable under mandatory law.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">Contact</h2>
            <p>
              Privacy questions can be sent to <a href="mailto:contact@helvetic-reserve.com" style={{ color: "var(--accent)" }}>contact@helvetic-reserve.com</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
