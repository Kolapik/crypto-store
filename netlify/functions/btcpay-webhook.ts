import { hydrateNetlifyEnv } from "./_shared/netlifyEnv";

type PaymentModules = {
  processBtcpayWebhookPayload: typeof import("../../server/payments/btcpay").processBtcpayWebhookPayload;
  verifyBtcpayWebhookSignature: typeof import("../../server/payments/btcpay").verifyBtcpayWebhookSignature;
};

let paymentModulesPromise: Promise<PaymentModules> | null = null;

function loadPaymentModules() {
  hydrateNetlifyEnv();

  paymentModulesPromise ??= import("../../server/payments/btcpay").then((module) => ({
    processBtcpayWebhookPayload: module.processBtcpayWebhookPayload,
    verifyBtcpayWebhookSignature: module.verifyBtcpayWebhookSignature,
  }));

  return paymentModulesPromise;
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const { processBtcpayWebhookPayload, verifyBtcpayWebhookSignature } =
    await loadPaymentModules();

  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("btcpay-sig") ?? undefined;

  if (!verifyBtcpayWebhookSignature(rawBody, signature)) {
    return Response.json({ error: "Invalid BTCPay webhook signature." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    const result = await processBtcpayWebhookPayload(payload);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid BTCPay webhook payload.";
    console.error(`[BTCPay] Netlify webhook failed: ${message}`);
    return Response.json({ error: "Invalid BTCPay webhook payload." }, { status: 400 });
  }
};

export const config = {
  path: "/api/payments/btcpay/webhook",
};
