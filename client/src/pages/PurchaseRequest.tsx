import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";

type CryptoCurrency =
  | "btc"
  | "eth"
  | "usdt"
  | "usdc"
  | "xmr"
  | "ltc"
  | "doge"
  | "dash"
  | "sol"
  | "bnb"
  | "trx"
  | "matic"
  | "none"
  | "other";

export default function PurchaseRequest() {
  const { watchId } = useParams<{ watchId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(watchId, 10);

  const { data: watch } = trpc.watches.list.useQuery({});
  const thisWatch = (watch ?? []).find(w => w.id === id);

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerCountry: "",
    preferredPaymentMethod: "crypto" as "crypto" | "bank_transfer" | "other",
    cryptoCurrency: "none" as CryptoCurrency,
    walletAddress: "",
    transactionHash: "",
    message: "",
  });
  const [error, setError] = useState("");

  const createMutation = trpc.requests.create.useMutation({
    onSuccess: (result) => {
      if (result.payment.enabled && "checkoutUrl" in result.payment) {
        window.location.href = result.payment.checkoutUrl;
        return;
      }
      navigate("/request/confirmation");
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.customerName.trim() || !form.customerEmail.trim()) {
      setError("Name and email are required.");
      return;
    }
    createMutation.mutate({ watchId: id, ...form });
  };

  return (
    <main style={{ paddingTop: "var(--nav-h)" }}>
      <div className="section page" style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <p className="section-eyebrow">No payment obligation</p>
          <h1 className="section-title">Request a watch</h1>
          {thisWatch && (
            <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
              {thisWatch.brand} {thisWatch.model}
              {thisWatch.reference ? ` — Ref. ${thisWatch.reference}` : ""}
            </p>
          )}
          <p className="section-lede" style={{ marginTop: "0.75rem" }}>
            Submit your details below. If crypto checkout is available, you can continue to BTCPay after the request. Helvetic Reserve still manually reviews availability, compliance, delivery, and final fulfilment.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full name *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Jean Dupont"
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email address *</label>
              <input
                className="form-input"
                type="email"
                placeholder="jean@example.com"
                value={form.customerEmail}
                onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <input
                className="form-input"
                type="tel"
                placeholder="+41 79 000 00 00"
                value={form.customerPhone}
                onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                className="form-input"
                type="text"
                placeholder="Switzerland"
                value={form.customerCountry}
                onChange={e => setForm(f => ({ ...f, customerCountry: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Preferred payment method</label>
              <select
                className="form-select"
                value={form.preferredPaymentMethod}
                onChange={e => setForm(f => ({ ...f, preferredPaymentMethod: e.target.value as any }))}
              >
                <option value="crypto">Crypto, confirmed manually</option>
                <option value="bank_transfer">Bank transfer, by exception</option>
                <option value="other">Discuss options</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Crypto currency</label>
              <select
                className="form-select"
                value={form.cryptoCurrency}
                onChange={e => setForm(f => ({ ...f, cryptoCurrency: e.target.value as CryptoCurrency }))}
              >
                <option value="none">Choose in checkout / not decided</option>
                <option value="btc">Bitcoin (BTC)</option>
                <option value="eth">Ethereum (ETH)</option>
                <option value="usdt">Tether (USDT)</option>
                <option value="usdc">USD Coin (USDC)</option>
                <option value="xmr">Monero (XMR)</option>
                <option value="ltc">Litecoin (LTC)</option>
                <option value="doge">Dogecoin (DOGE)</option>
                <option value="dash">Dash (DASH)</option>
                <option value="sol">Solana (SOL)</option>
                <option value="bnb">BNB</option>
                <option value="trx">TRON (TRX)</option>
                <option value="matic">Polygon (MATIC)</option>
                <option value="other">Other crypto</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Wallet address (optional)</label>
              <input
                className="form-input"
                type="text"
                placeholder="Only if already relevant"
                value={form.walletAddress}
                onChange={e => setForm(f => ({ ...f, walletAddress: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Transaction hash (optional)</label>
              <input
                className="form-input"
                type="text"
                placeholder="Leave empty before payment"
                value={form.transactionHash}
                onChange={e => setForm(f => ({ ...f, transactionHash: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Message (optional)</label>
            <textarea
              className="form-textarea"
              placeholder="Any questions or details about your request…"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            />
          </div>

          {error && (
            <p style={{ color: "var(--error)", fontSize: "0.82rem" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              className="button lg"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Sending..." : "Submit request"}
            </button>
            <Link href={`/watches/${thisWatch?.slug ?? ""}`} className="button secondary">
              Cancel
            </Link>
          </div>

          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            By submitting this form you agree to be contacted at {""}
            <a href="mailto:contact@helvetic-reserve.com" style={{ color: "var(--accent)" }}>contact@helvetic-reserve.com</a>{" "}
            or by the details provided. BTCPay checkout may show the enabled coins for this store, including XMR when your BTCPay Monero plugin is configured. A payment does not bypass manual compliance, availability, delivery, or fulfilment review.
          </p>
        </form>
      </div>
    </main>
  );
}
