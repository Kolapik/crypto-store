import type { PublicWatch, PurchaseRequestDto } from "./db";
import { ENV } from "./_core/env";

type EmailPayload = {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

type CloudflareEmailResponse = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: {
    delivered?: string[];
    queued?: string[];
    permanent_bounces?: string[];
  } | null;
};

function isEmailConfigured() {
  return Boolean(
    ENV.cloudflareAccountId &&
      ENV.cloudflareEmailApiToken &&
      ENV.cloudflareEmailFrom &&
      ENV.cloudflareEmailTo,
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(price: string | null, currency: string | null) {
  if (!price) return "Price on request";
  const number = Number(price);
  const formatted = Number.isFinite(number) ? number.toLocaleString("de-CH") : price;
  return `${currency ?? "CHF"} ${formatted}`;
}

export async function sendCloudflareEmail(payload: EmailPayload) {
  if (!isEmailConfigured()) {
    return { skipped: true, reason: "Cloudflare Email Service is not configured." } as const;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ENV.cloudflareAccountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.cloudflareEmailApiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: payload.to,
        from: payload.from ?? ENV.cloudflareEmailFrom,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        replyTo: payload.replyTo,
      }),
    },
  );

  const body = (await response.json().catch(() => null)) as CloudflareEmailResponse | null;
  if (!response.ok || !body?.success) {
    const cloudflareMessage = body?.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(cloudflareMessage || `Cloudflare Email Service returned HTTP ${response.status}`);
  }

  return {
    skipped: false,
    delivered: body.result?.delivered ?? [],
    queued: body.result?.queued ?? [],
  } as const;
}

function requestText(request: PurchaseRequestDto, watch: PublicWatch) {
  return [
    "New Helvetic Reserve purchase request",
    "",
    `Watch: ${watch.brand} ${watch.model}${watch.reference ? ` (${watch.reference})` : ""}`,
    `Price: ${money(watch.price, watch.currency)}`,
    `Customer: ${request.customerName}`,
    `Email: ${request.customerEmail}`,
    request.customerPhone ? `Phone: ${request.customerPhone}` : null,
    request.customerCountry ? `Country: ${request.customerCountry}` : null,
    `Payment preference: ${request.preferredPaymentMethod}`,
    request.cryptoCurrency && request.cryptoCurrency !== "none"
      ? `Crypto: ${request.cryptoCurrency.toUpperCase()}`
      : null,
    request.message ? `Message: ${request.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function requestHtml(request: PurchaseRequestDto, watch: PublicWatch) {
  const rows = [
    ["Watch", `${watch.brand} ${watch.model}${watch.reference ? ` (${watch.reference})` : ""}`],
    ["Price", money(watch.price, watch.currency)],
    ["Customer", request.customerName],
    ["Email", request.customerEmail],
    ["Phone", request.customerPhone],
    ["Country", request.customerCountry],
    ["Payment preference", request.preferredPaymentMethod],
    ["Crypto", request.cryptoCurrency && request.cryptoCurrency !== "none" ? request.cryptoCurrency.toUpperCase() : null],
    ["Message", request.message],
  ].filter(([, value]) => value);

  return `
    <h1>New purchase request</h1>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`,
        )
        .join("")}
    </table>
  `;
}

function customerConfirmationText(request: PurchaseRequestDto, watch: PublicWatch) {
  return [
    `Hello ${request.customerName},`,
    "",
    `We received your request for ${watch.brand} ${watch.model}${watch.reference ? ` (${watch.reference})` : ""}.`,
    "Helvetic Reserve will confirm availability, final price, compliance, delivery, and payment instructions before any sale proceeds.",
    "",
    "This message is not a payment instruction or sale confirmation.",
    "",
    "Helvetic Reserve",
  ].join("\n");
}

export async function notifyPurchaseRequest(request: PurchaseRequestDto, watch: PublicWatch) {
  const results: Array<Awaited<ReturnType<typeof sendCloudflareEmail>>> = [];

  results.push(
    await sendCloudflareEmail({
      to: ENV.cloudflareEmailTo,
      subject: `New request: ${watch.brand} ${watch.model}`,
      text: requestText(request, watch),
      html: requestHtml(request, watch),
      replyTo: request.customerEmail,
    }),
  );

  if (ENV.cloudflareEmailSendCustomerConfirmation) {
    const text = customerConfirmationText(request, watch);
    results.push(
      await sendCloudflareEmail({
        to: request.customerEmail,
        subject: "We received your Helvetic Reserve request",
        text,
        html: `<p>${escapeHtml(text).replace(/\n/g, "<br />")}</p>`,
      }),
    );
  }

  return results;
}

export function emailStatus() {
  if (!isEmailConfigured()) return "cloudflare-email-service-not-configured";
  return ENV.cloudflareEmailSendCustomerConfirmation
    ? "cloudflare-email-service-admin-and-customer"
    : "cloudflare-email-service-admin-only";
}
