import { describe, expect, it } from "vitest";
import {
  buildImageEnhancementPrompt,
  isEnhanceableImageContentType,
} from "./imageEnhancement";

describe("AI image enhancement guardrails", () => {
  it("only allows image formats that can be safely enhanced", () => {
    expect(isEnhanceableImageContentType("image/jpeg")).toBe(true);
    expect(isEnhanceableImageContentType("image/png; charset=binary")).toBe(true);
    expect(isEnhanceableImageContentType("image/webp")).toBe(true);
    expect(isEnhanceableImageContentType("image/svg+xml")).toBe(false);
    expect(isEnhanceableImageContentType("text/html")).toBe(false);
  });

  it("builds a prompt that preserves real watch details instead of inventing them", () => {
    const prompt = buildImageEnhancementPrompt({
      brand: "Rolex",
      model: "Submariner",
      reference: "124060",
    } as any);

    expect(prompt).toContain("Preserve the exact watch");
    expect(prompt).toContain("dial text");
    expect(prompt).toContain("do not invent text");
    expect(prompt).toContain("Rolex Submariner 124060");
  });
});
