import { describe, expect, it } from "vitest";
import { getProjectTabs } from "./project-tabs";

describe("getProjectTabs", () => {
  it("shows prescreen tab", () => {
    expect(
      getProjectTabs({
        preScreen: true,
        quotasEnabled: false,
      }).showPreScreen
    ).toBe(true);
  });

  it("hides prescreen tab", () => {
    expect(
      getProjectTabs({
        preScreen: false,
        quotasEnabled: false,
      }).showPreScreen
    ).toBe(false);
  });

  it("shows quota tab", () => {
    expect(
      getProjectTabs({
        preScreen: false,
        quotasEnabled: true,
      }).showQuotas
    ).toBe(true);
  });

  it("hides quota tab", () => {
    expect(
      getProjectTabs({
        preScreen: false,
        quotasEnabled: false,
      }).showQuotas
    ).toBe(false);
  });
});
