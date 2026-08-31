import { describe, expect, it } from "vitest";
import { replaceTokens } from "./survey-live-url";
import { resolveEffectiveRecid } from "./recontact";

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

  it("uses stored recid in final survey live URL when incoming recid is blank", () => {
    const effectiveRecid = resolveEffectiveRecid(
      "",
      "STORED-RECID-001"
    );

    const destination = replaceTokens(
      "https://survey.com/?rid=[identifier]&recid=[recid]",
      {
        identifier: "PID123",
        recid: effectiveRecid,
      }
    );

    expect(destination).toBe(
      "https://survey.com/?rid=PID123&recid=STORED-RECID-001"
    );
  });
});
