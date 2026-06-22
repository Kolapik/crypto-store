import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./_core/passwordHash";

describe("admin password hashing", () => {
  it("verifies the original password and rejects a different one", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong horse battery staple", hash)).resolves.toBe(false);
  });

  it("rejects malformed hashes without throwing", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
  });
});
