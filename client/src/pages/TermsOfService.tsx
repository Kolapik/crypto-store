export default function TermsOfService() {
  return (
    <main style={{ paddingTop: "var(--nav-h)" }}>
      <div className="section page" style={{ maxWidth: 900, margin: "0 auto" }}>
        <p className="section-eyebrow">Helvetic Reserve</p>
        <h1 className="section-title">Terms of Service</h1>
        <p className="section-lede">
          Operational draft for helvetic-reserve.com. Final legal review is still required before production launch.
        </p>

        <div style={{ display: "grid", gap: "1.25rem", color: "var(--text-secondary)", lineHeight: 1.7, marginTop: "2rem" }}>
          <section>
            <h2 className="admin-table-title">Request-based service</h2>
            <p>
              Helvetic Reserve is a Switzerland-based, request-based luxury watch broker and seller. The website does not provide instant checkout. A submitted request is an inquiry only and does not create a binding sale, invoice, reservation, or payment obligation.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">Availability and pricing</h2>
            <p>
              Product details, availability, prices, delivery options, taxes, customs, insurance, and payment instructions are shown in good faith and remain subject to manual confirmation. Helvetic Reserve may refuse, cancel, or decline a request, including where a watch is unavailable, pricing has changed, compliance checks are not satisfied, or the request appears suspicious.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">Payment and compliance</h2>
            <p>
              The MVP supports crypto payment review manually. No payment instruction is valid until Helvetic Reserve confirms the final price, availability, compliance requirements, delivery terms, and payment details directly. Helvetic Reserve may request identification, proof/source of funds, wallet information, transaction hash, billing or shipping information, and other compliance information before proceeding.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">Delivery, taxes, and returns</h2>
            <p>
              International delivery may be possible case by case. Unless explicitly agreed otherwise, the customer is responsible for import duties, customs fees, taxes, and local compliance obligations. Sales are final once manually confirmed and completed, especially for sourced, special, high-value, or crypto-paid items, except where mandatory law provides otherwise.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">Private supplier data</h2>
            <p>
              Supplier names, supplier URLs, source URLs, supplier prices, acquisition costs, internal notes, compliance notes, and private supplier images are internal Helvetic Reserve data. They are not public customer data and must not be exposed on public pages or public APIs.
            </p>
          </section>

          <section>
            <h2 className="admin-table-title">Contact</h2>
            <p>
              For service questions, contact <a href="mailto:contact@helvetic-reserve.com" style={{ color: "var(--accent)" }}>contact@helvetic-reserve.com</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
