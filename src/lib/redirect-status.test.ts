import { describe, expect, it } from "vitest";
import { canChangeProjectType } from "./redirect-status";

describe("canChangeProjectType", () => {
  it("rejects Adhocs -> Recontact", () => {
    expect(
      canChangeProjectType(
        "Adhocs",
        "Recontact"
      )
    ).toBe(false);
  });

  it("rejects Recontact -> Adhocs", () => {
    expect(
      canChangeProjectType(
        "Recontact",
        "Adhocs"
      )
    ).toBe(false);
  });

  it("allows Adhocs -> Adhocs", () => {
    expect(
      canChangeProjectType(
        "Adhocs",
        "Adhocs"
      )
    ).toBe(true);
  });

  it("allows Recontact -> Recontact", () => {
    expect(
      canChangeProjectType(
        "Recontact",
        "Recontact"
      )
    ).toBe(true);
  });
});
