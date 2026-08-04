import { describe, expect, it } from "vitest";
import { LIBRARY_PROFILES, LIBRARY_QUESTIONS, } from "./prescreenlibrary";

describe("prescreenLibrary", () => {
  it("contains travel profile", () => {
    expect(
      LIBRARY_PROFILES.some(
        (profile) => profile.key === "travel"
      )
    ).toBe(true);
  });

  it("contains health questions", () => {
    expect(LIBRARY_QUESTIONS.health.length).toBeGreaterThan(0);
  });
});