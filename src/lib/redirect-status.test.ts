import { describe, expect, it } from "vitest";
import { isProjectTypeImmutable } from "./redirect-status";

describe("isProjectTypeImmutable", () => {
  it("rejects Adhocs -> Recontact", () => {
    expect(
      isProjectTypeImmutable(
        "Adhocs",
        "Recontact"
      )
    ).toBe(false);
  });

  it("rejects Recontact -> Adhocs", () => {
    expect(
      isProjectTypeImmutable(
        "Recontact",
        "Adhocs"
      )
    ).toBe(false);
  });

  it("allows Adhocs -> Adhocs", () => {
    expect(
      isProjectTypeImmutable(
        "Adhocs",
        "Adhocs"
      )
    ).toBe(true);
  });

  it("allows Recontact -> Recontact", () => {
    expect(
      isProjectTypeImmutable(
        "Recontact",
        "Recontact"
      )
    ).toBe(true);
  });
});
