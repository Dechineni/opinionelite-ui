import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { validateDrakoAccess } from "@/lib/drako/validation";

// MOCK PRISMA CLIENT
vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(() => ({})),
}));

// MOCK DRAKO VALIDATION
vi.mock("@/lib/drako/validation", () => ({
  validateDrakoAccess: vi.fn(),
}));

vi.mock("@/lib/drako/url-config", () => ({
  getDrakoBaseUrl: vi.fn(
    () => "https://opinion-elite.com"
  ),
}));

// CREATE TYPED MOCK
const mockedValidateDrakoAccess = vi.mocked(
  validateDrakoAccess
);

describe("DRAKO Landing Route", () => {
  beforeEach(() => {

    // RESET MOCKS BEFORE EACH TEST
    vi.clearAllMocks();

    // SET APPLICATION URL
    process.env.APP_URL =
      "https://opinion-elite.com";
  });

  // VERIFY PROJECTID IS REQUIRED
  it("returns 400 when projectId is missing", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  // VERIFY SUPPLIERID IS REQUIRED
  it("returns 400 when supplierId is missing", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  // VERIFY DIRECT ACCESS WITHOUT PARAMETERS IS REJECTED
  it("rejects direct entry without parameters", async () => {
    const request = new Request(
      "http://localhost/campaign/drako"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  // VERIFY EMPTY PROJECT ID IS REJECTED
  it("rejects empty projectId", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?projectId=&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  // VERIFY EMPTY SUPPLIER ID IS REJECTED
  it("rejects empty supplierId", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId="
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  // VERIFY INVALID REQUESTS DO NOT REDIRECT
  it("does not redirect when validation fails", async () => {
    mockedValidateDrakoAccess.mockResolvedValue({
      valid: false,
      status: 403,
    } as any);

    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(403);

    expect(
      response.headers.get("location")
    ).toBeNull();
  });

  // VERIFY PLACEHOLDER PROJECT IDENTIFIERS ARE NOT ALLOWED
  it("rejects placeholder project ids", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?projectId=[identifier]&supplierId=DRAKO"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  // VERIFY PLACEHOLDER SUPPLIER IDENTIFIERS ARE NOT ALLOWED
  it("rejects placeholder supplier ids", async () => {
    const request = new Request(
      "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=[identifier]"
    );

    const response = await GET(
      request as any
    );

    expect(response.status).toBe(400);
  });

  // VERIFY INELIGIBLE SUPPLIERS ARE REJECTED
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

  // VERIFY DISABLED SUPPLIER MAPPINGS ARE REJECTED
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

  // VERIFY VALID REQUESTS REDIRECT TO SURVEY PAGE
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

  // VERIFY RESPONDENT ID IS GENERATED CORRECTLY
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

  // VERIFY RESPONSE IS NOT CACHED
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

  // VERIFY UNEXPECTED ERRORS RETURN 500
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

  // VERIFY EVERY REQUEST GETS A UNIQUE RESPONDENT ID
  it("generates different ids for three requests", async () => {

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

  const ids = new Set<string>();

  for (let i = 0; i < 3; i++) {
    const response = await GET(
      new Request(
        "http://localhost/campaign/drako?projectId=PROJECT1&supplierId=DRAKO"
      ) as any
    );

    const location = response.headers.get("location");
    const id = new URL(location!).searchParams.get("id");

    ids.add(id!);
  }

  expect(ids.size).toBe(3);
  });

});
