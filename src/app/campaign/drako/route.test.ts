import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { validateDrakoAccess } from "@/lib/drako/validation";

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(() => ({})),
}));

vi.mock("@/lib/drako/validation", () => ({
  validateDrakoAccess: vi.fn(),
}));

const mockedValidateDrakoAccess = vi.mocked(
  validateDrakoAccess
);

describe("DRAKO Landing Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.APP_URL =
      "https://opinion-elite.com";
  });

  it("returns 400 when projectId is missing", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when supplierId is missing", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  it("rejects placeholder project ids", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?projectId=[identifier]&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  it("rejects placeholder supplier ids", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=[identifier]"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  it("rejects ineligible suppliers", async () => {
    mockedValidateDrakoAccess.mockResolvedValue({
      valid: false,
      status: 403,
    } as any);

    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=INVALID"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(403);
  });

  it("rejects disabled mappings", async () => {
    mockedValidateDrakoAccess.mockResolvedValue({
      valid: false,
      status: 404,
    } as any);

    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(404);
  });

  it("redirects eligible users into Survey", async () => {
    mockedValidateDrakoAccess.mockResolvedValue({
      valid: true,
      project: {
        id: "project-1",
        code: "PROJECT1",
      },
      supplier: {
        id: "supplier-1",
        code: "DRAKO",
      },
    } as any);

    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(302);

    const location =
      response.headers.get("location");

    expect(location).not.toBeNull();

    expect(location).toContain(
      "/Survey"
    );

    expect(location).toContain(
      "projectId=PROJECT1"
    );

    expect(location).toContain(
      "supplierId=DRAKO"
    );
  });

  it("generates secure DRK respondent identifiers", async () => {
    mockedValidateDrakoAccess.mockResolvedValue({
      valid: true,
      project: {
        id: "project-1",
        code: "PROJECT1",
      },
      supplier: {
        id: "supplier-1",
        code: "DRAKO",
      },
    } as any);

    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    const location =
      response.headers.get("location");

    expect(location).not.toBeNull();

    const url = new URL(location!);

    const respondentId =
      url.searchParams.get("id");

    expect(respondentId).toMatch(
      /^DRK-/
    );

    expect(
      respondentId!.length
    ).toBeGreaterThan(20);
  });

  it("adds no-cache headers", async () => {
    mockedValidateDrakoAccess.mockResolvedValue({
      valid: true,
      project: {
        id: "project-1",
        code: "PROJECT1",
      },
      supplier: {
        id: "supplier-1",
        code: "DRAKO",
      },
    } as any);

    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(
      response.headers.get(
        "Cache-Control"
      )
    ).toContain("no-store");
  });

  it("returns 500 when validation throws", async () => {
    mockedValidateDrakoAccess.mockRejectedValue(
      new Error("boom")
    );

    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(500);
  });
});