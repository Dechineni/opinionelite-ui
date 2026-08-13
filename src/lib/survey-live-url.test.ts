import { describe, expect, it } from "vitest";
import { replaceTokens } from "./survey-live-url";

describe("replaceTokens", () => {
  it("replaces identifier token", () => {
    expect(
      replaceTokens(
        "https://site.com?id=[identifier]",
        {
          identifier: "PID123",
        }
      )
    ).toContain("PID123");
  });

  it("replaces recid token", () => {
    expect(
      replaceTokens(
        "https://site.com?recid=[recid]",
        {
          recid: "REC001",
        }
      )
    ).toContain("REC001");
  });

  it("replaces projectId token", () => {
    expect(
      replaceTokens(
        "https://site.com?p=[projectId]",
        {
          projectId: "SR123",
        }
      )
    ).toContain("SR123");
  });

  it("replaces missing recid with blank", () => {
    expect(
      replaceTokens(
        "https://site.com?recid=[recid]",
        {}
      )
    ).toContain("recid=");
  });

  it("supports square bracket syntax", () => {
    expect(
      replaceTokens("[id]", {
        id: "123",
      })
    ).toBe("123");
  });

  it("supports curly bracket syntax", () => {
    expect(
      replaceTokens("{id}", {
        id: "123",
      })
    ).toBe("123");
  });
});
