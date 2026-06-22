import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { emailStatus, sendCloudflareEmail } from "./email";

const originalEnv = { ...ENV };

function setEmailEnv(overrides: Partial<typeof ENV>) {
  Object.assign(ENV, {
    cloudflareAccountId: "account_test",
    cloudflareEmailApiToken: "token_test",
    cloudflareEmailFrom: "contact@helvetic-reserve.com",
    cloudflareEmailTo: "contact@helvetic-reserve.com",
    cloudflareEmailSendCustomerConfirmation: false,
    ...overrides,
  });
}

describe("Cloudflare Email Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setEmailEnv({});
  });

  afterEach(() => {
    Object.assign(ENV, originalEnv);
  });

  it("sends email through the Cloudflare REST endpoint", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        success: true,
        errors: [],
        messages: [],
        result: { delivered: ["contact@helvetic-reserve.com"], queued: [] },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await sendCloudflareEmail({
      to: "contact@helvetic-reserve.com",
      subject: "Test",
      text: "Hello",
    });

    expect(result).toMatchObject({ skipped: false, delivered: ["contact@helvetic-reserve.com"] });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account_test/email/sending/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer token_test",
          "content-type": "application/json",
        }),
      }),
    );
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body).toMatchObject({
      to: "contact@helvetic-reserve.com",
      from: "contact@helvetic-reserve.com",
      subject: "Test",
      text: "Hello",
    });
  });

  it("skips sending when Cloudflare Email Service is not configured", async () => {
    setEmailEnv({ cloudflareEmailApiToken: "" });
    global.fetch = vi.fn() as typeof fetch;

    const result = await sendCloudflareEmail({
      to: "contact@helvetic-reserve.com",
      subject: "Test",
      text: "Hello",
    });

    expect(result).toMatchObject({ skipped: true });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(emailStatus()).toBe("cloudflare-email-service-not-configured");
  });
});
