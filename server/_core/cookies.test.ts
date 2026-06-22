import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./cookies";

describe("session cookie options", () => {
  it("uses a localhost-compatible SameSite policy for plain HTTP", () => {
    const options = getSessionCookieOptions({
      protocol: "http",
      headers: {},
    } as Request);

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("marks cookies secure behind HTTPS proxies", () => {
    const options = getSessionCookieOptions({
      protocol: "http",
      headers: { "x-forwarded-proto": "https" },
    } as unknown as Request);

    expect(options).toMatchObject({
      sameSite: "lax",
      secure: true,
    });
  });
});
