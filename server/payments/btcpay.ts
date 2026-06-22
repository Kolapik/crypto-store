import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { ENV } from "../_core/env";
import type { PublicWatch, PurchaseRequestDto } from "../db";
import {
  updatePurchaseRequestPayment,
  updatePurchaseRequestPaymentByInvoiceId,
} from "../db";

type BtcpayInvoiceResponse = {
  id?: string;
  status?: string;
  checkoutLink?: string;
  checkoutUrl?: string;
  amount?: string | number;
  currency?: string;
  createdTime?: number | string;
  expirationTime?: number | string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type PaymentResult =
  | { enabled: false; reason: string }
  | {
      enabled: true;
      processor: "btcpay";
      invoiceId: string;
      checkoutUrl: string;
      status: string;
    }
  | { enabled: true; processor: "btcpay"; error: string };

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getBtcpayBaseUrl() {
  if (!ENV.btcpayEnabled) return null;
  if (!ENV.btcpayServerUrl || !ENV.btcpayStoreId || !ENV.btcpayApiKey) return null;

  const url = new URL(ENV.btcpayServerUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("BTCPAY_SERVER_URL must be an HTTP(S) URL.");
  }
  if (ENV.isProduction && url.protocol !== "https:" && !isLocalHostname(url.hostname)) {
    throw new Error("BTCPAY_SERVER_URL must use HTTPS in production.");
  }

  return url.origin;
}

function paymentConfigured() {
  try {
    return Boolean(getBtcpayBaseUrl());
  } catch {
    return false;
  }
}

function parseBtcpayTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return new Date(numeric * 1000);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function checkoutUrl(baseUrl: string, invoice: BtcpayInvoiceResponse, invoiceId: string) {
  const direct = invoice.checkoutLink ?? invoice.checkoutUrl;
  if (typeof direct === "string" && direct.startsWith("http")) return direct;
  return `${baseUrl}/i/${encodeURIComponent(invoiceId)}`;
}

function publicPrice(watch: PublicWatch) {
  const amount = Number(watch.price ?? watch.publicPrice);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function orderUrl(requestId: number) {
  const base = ENV.publicSiteUrl.replace(/\/+$/, "");
  return `${base}/request/confirmation?request=${encodeURIComponent(String(requestId))}`;
}

function compactInvoiceRaw(invoice: BtcpayInvoiceResponse) {
  return {
    id: invoice.id,
    status: invoice.status,
    amount: invoice.amount,
    currency: invoice.currency,
    checkoutLink: invoice.checkoutLink ?? invoice.checkoutUrl,
    createdTime: invoice.createdTime,
    expirationTime: invoice.expirationTime,
    metadata: invoice.metadata,
  };
}

export function btcpayStatus() {
  if (!ENV.btcpayEnabled) return "btcpay-disabled";
  return paymentConfigured() ? "btcpay-configured" : "btcpay-missing-env";
}

export async function createBtcpayInvoiceForRequest(input: {
  request: PurchaseRequestDto;
  watch: PublicWatch;
}): Promise<PaymentResult> {
  if (input.request.preferredPaymentMethod !== "crypto") {
    return { enabled: false, reason: "non-crypto-payment-method" };
  }

  const baseUrl = getBtcpayBaseUrl();
  if (!baseUrl) return { enabled: false, reason: "btcpay-not-configured" };

  const amount = publicPrice(input.watch);
  if (amount === null) return { enabled: false, reason: "missing-public-price" };

  const currency = input.watch.currency || ENV.btcpayDefaultCurrency;
  const description = `${input.watch.brand} ${input.watch.model}${
    input.watch.reference ? ` (${input.watch.reference})` : ""
  }`;
  const payload = {
    amount,
    currency,
    metadata: {
      orderId: `purchase-request-${input.request.id}`,
      orderUrl: orderUrl(input.request.id),
      buyerName: input.request.customerName,
      buyerEmail: input.request.customerEmail,
      buyerCountry: input.request.customerCountry ?? undefined,
      itemDesc: description,
      helveticReserveRequestId: input.request.id,
      preferredCrypto: input.request.cryptoCurrency ?? "none",
    },
    checkout: {
      redirectURL: orderUrl(input.request.id),
      redirectAutomatically: false,
    },
  };

  const endpoint = `${baseUrl}/api/v1/stores/${encodeURIComponent(ENV.btcpayStoreId)}/invoices`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `token ${ENV.btcpayApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as BtcpayInvoiceResponse | null;
  if (!response.ok || !body?.id) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : `BTCPay invoice creation failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  const invoiceId = body.id;
  const link = checkoutUrl(baseUrl, body, invoiceId);
  const status = String(body.status ?? "new");

  await updatePurchaseRequestPayment(input.request.id, {
    paymentProcessor: "btcpay",
    paymentInvoiceId: invoiceId,
    paymentCheckoutUrl: link,
    paymentStatus: status,
    paymentAmount: amount.toFixed(2),
    paymentCurrency: currency,
    paymentInvoiceCreatedAt: parseBtcpayTime(body.createdTime),
    paymentInvoiceExpiresAt: parseBtcpayTime(body.expirationTime),
    paymentRawData: compactInvoiceRaw(body),
  });

  return {
    enabled: true,
    processor: "btcpay",
    invoiceId,
    checkoutUrl: link,
    status,
  };
}

export function verifyBtcpayWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  const secret = ENV.btcpayWebhookSecret || process.env.BTCPAY_WEBHOOK_SECRET || "";
  if (!secret || !signature) return false;

  const expected = Buffer.from(
    `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
    "utf8",
  );
  const received = Buffer.from(signature, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function btcpayPaymentStatusFromWebhook(type: string, invoiceStatus?: string) {
  const normalizedType = type.toLowerCase();
  const normalizedInvoiceStatus = invoiceStatus?.toLowerCase();

  if (normalizedType.includes("settled") || normalizedInvoiceStatus === "settled") return "settled";
  if (normalizedType.includes("processing") || normalizedInvoiceStatus === "processing") return "processing";
  if (normalizedType.includes("expired") || normalizedInvoiceStatus === "expired") return "expired";
  if (normalizedType.includes("invalid") || normalizedInvoiceStatus === "invalid") return "invalid";
  if (normalizedType.includes("received")) return "received";
  if (normalizedInvoiceStatus) return normalizedInvoiceStatus;
  return normalizedType.replace(/^invoice/i, "").toLowerCase() || "unknown";
}

export async function processBtcpayWebhookPayload(payload: Record<string, unknown>) {
  const invoiceId = typeof payload.invoiceId === "string" ? payload.invoiceId : "";
  const eventType = typeof payload.type === "string" ? payload.type : "";
  const invoiceStatus = typeof payload.status === "string" ? payload.status : undefined;

  if (!invoiceId || !eventType) {
    throw new Error("BTCPay webhook is missing invoiceId or type.");
  }

  const paymentStatus = btcpayPaymentStatusFromWebhook(eventType, invoiceStatus);
  const isSettled = paymentStatus === "settled";
  const request = await updatePurchaseRequestPaymentByInvoiceId(invoiceId, {
    paymentStatus,
    paymentSettledAt: isSettled ? new Date() : undefined,
    paymentRawData: {
      webhookType: eventType,
      invoiceId,
      status: invoiceStatus,
      timestamp: payload.timestamp,
      storeId: payload.storeId,
      deliveryId: payload.deliveryId,
    },
    status: isSettled ? "confirmed" : undefined,
  });

  return { invoiceId, paymentStatus, requestFound: Boolean(request) };
}

export function registerBtcpayWebhookRoute(app: Express) {
  app.post("/api/payments/btcpay/webhook", async (req: RawBodyRequest, res: Response) => {
    if (!ENV.btcpayWebhookSecret) {
      res.status(503).json({ error: "BTCPay webhook secret is not configured." });
      return;
    }

    if (!verifyBtcpayWebhookSignature(req.rawBody ?? Buffer.alloc(0), req.header("BTCPAY-SIG"))) {
      res.status(401).json({ error: "Invalid BTCPay webhook signature." });
      return;
    }

    try {
      const result = await processBtcpayWebhookPayload(req.body as Record<string, unknown>);
      res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "BTCPay webhook failed.";
      console.error(`[BTCPay] Webhook failed: ${message}`);
      res.status(400).json({ error: "Invalid BTCPay webhook payload." });
    }
  });
}
