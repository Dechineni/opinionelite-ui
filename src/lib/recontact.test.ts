import { describe, expect, it } from "vitest";
import { resolveEffectiveRecid } from "./recontact";

describe("resolveEffectiveRecid", () => {
  it("uses incoming recid when provided", () => {
    expect(
      resolveEffectiveRecid("NEW123", "OLD123")
    ).toBe("NEW123");
  });

  it("uses stored recid when incoming is blank", () => {
    expect(
      resolveEffectiveRecid("   ", "OLD123")
    ).toBe("OLD123");
  });

  it("uses stored recid when incoming is missing", () => {
    expect(
      resolveEffectiveRecid(undefined, "OLD123")
    ).toBe("OLD123");
  });

  it("returns empty string when both are missing", () => {
    expect(
      resolveEffectiveRecid(undefined, undefined)
    ).toBe("");
  });

  it("allows same recid for separate external ids", () => {
    expect(
      resolveEffectiveRecid(
        "PANELIST-777",
        "PANELIST-777"
      )
    ).toBe("PANELIST-777");
  });
});
