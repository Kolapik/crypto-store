import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  btcpayPaymentStatusFromWebhook,
  verifyBtcpayWebhookSignature,
} from "./btcpay";

describe("BTCPay payment helpers", () => {
  const originalSecret = process.env.BTCPAY_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.BTCPAY_WEBHOOK_SECRET;
    } else {
      process.env.BTCPAY_WEBHOOK_SECRET = originalSecret;
    }
  });

  it("validates BTCPay webhook signatures using HMAC", async () => {
    process.env.BTCPAY_WEBHOOK_SECRET = "test-webhook-secret";
    const body = Buffer.from(JSON.stringify({ invoiceId: "abc", type: "InvoiceSettled" }));
    const signature = `sha256=${createHmac("sha256", "test-webhook-secret").update(body).digest("hex")}`;

    expect(verifyBtcpayWebhookSignature(body, signature)).toBe(true);
    expect(verifyBtcpayWebhookSignature(body, "sha256=bad")).toBe(false);
  });

  it("normalizes invoice webhook events into local payment statuses", () => {
    expect(btcpayPaymentStatusFromWebhook("InvoiceSettled")).toBe("settled");
    expect(btcpayPaymentStatusFromWebhook("InvoiceExpired")).toBe("expired");
    expect(btcpayPaymentStatusFromWebhook("InvoicePaymentReceived")).toBe("received");
  });
});
