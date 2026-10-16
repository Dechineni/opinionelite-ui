import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SurveyLandingPage from "./page";

const replaceMock = vi.fn();

let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),

  useSearchParams: () => ({
    get: (key: string) => params.get(key),
  }),
}));

describe("Survey page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        preScreenEnabled: false,
        items: [],
      }),
    }) as any;

    params = new URLSearchParams();
  });

  it("processes a valid supplier entry", async () => {
    params = new URLSearchParams({
      projectId: "SR1000",
      supplierId: "S1007",
      id: "EXT001",
    });

    render(<SurveyLandingPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const firstCall = (fetch as any).mock.calls[0];

    expect(firstCall[0]).toBe(
      "/api/projects/SR1000/entry"
    );

    expect(
      JSON.parse(firstCall[1].body)
    ).toEqual({
      supplierId: "S1007",
      externalId: "EXT001",
      recid: "",
    });
  });

  it("does nothing when projectId is missing", async () => {
    params = new URLSearchParams({
      supplierId: "S1007",
      id: "EXT001",
    });

    render(<SurveyLandingPage />);

    await new Promise((resolve) =>
      setTimeout(resolve, 25)
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it("does nothing when id is missing", async () => {
    params = new URLSearchParams({
      projectId: "SR1000",
      supplierId: "S1007",
    });

    render(<SurveyLandingPage />);

    await new Promise((resolve) =>
      setTimeout(resolve, 25)
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it("includes recid when provided", async () => {
    params = new URLSearchParams({
      projectId: "SR1000",
      supplierId: "S1007",
      id: "EXT001",
      recid: "REC001",
    });

    render(<SurveyLandingPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const firstCall = (fetch as any).mock.calls[0];

    expect(firstCall[0]).toBe(
      "/api/projects/SR1000/entry"
    );

    expect(
      JSON.parse(firstCall[1].body)
    ).toEqual({
      supplierId: "S1007",
      externalId: "EXT001",
      recid: "REC001",
    });
  });

  it.each([
    "[identifier]",
    "{identifier}",
    "identifier",
    "   ",
  ])(
    "forwards externalId value %s to entry tracking",
    async (externalId) => {
      params = new URLSearchParams({
        projectId: "SR1000",
        supplierId: "S1007",
        id: externalId,
      });

      render(<SurveyLandingPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const firstCall = (fetch as any).mock.calls[0];

      expect(firstCall[0]).toBe(
        "/api/projects/SR1000/entry"
      );

      expect(
        JSON.parse(firstCall[1].body)
      ).toEqual({
        supplierId: "S1007",
        externalId,
        recid: "",
      });
    }
  );
  it("does nothing when externalId is empty", async () => {
  params = new URLSearchParams({
    projectId: "SR1000",
    supplierId: "S1007",
    id: "",
  });

  render(<SurveyLandingPage />);

  await new Promise((resolve) =>
    setTimeout(resolve, 25)
  );

  expect(fetch).not.toHaveBeenCalled();
});
});