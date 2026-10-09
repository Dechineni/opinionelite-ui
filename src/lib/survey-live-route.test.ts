import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/projects/[projectId]/survey-live/route";

const mockPrisma = {
  project: {
    findFirst: vi.fn(),
  },

  surveyRedirect: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },

  supplierEntry: {
    findFirst: vi.fn(),
  },

  respondent: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

describe("survey live route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 409 when finalized SurveyRedirect already exists", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
      surveyLiveUrl: "https://client.com/survey",
      projectType: "Adhocs",
    });

    mockPrisma.surveyRedirect.findFirst.mockResolvedValue({
      id: "RID1",
      result: "COMPLETE",
    });

    const req = new Request(
      "https://test.com/api/projects/PRJ1/survey-live?supplierId=S1007&id=EXT001"
    );

    const res = await GET(req, {
      params: Promise.resolve({
        projectId: "PRJ1",
      }),
    });

    expect(res.status).toBe(409);

    const body = await res.json();

    expect(body.error).toContain("Survey already attempted");
    expect(body.priorResult).toBe("COMPLETE");
  });

  it("returns 404 when project does not exist", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = new Request(
      "https://test.com/api/projects/PRJ404/survey-live?supplierId=S1&id=EXT1"
    );

    const res = await GET(req, {
      params: Promise.resolve({
        projectId: "PRJ404",
      }),
    });

    expect(res.status).toBe(404);

    const body = await res.json();

    expect(body.error).toContain("Project not found");
  });

  it("returns 400 when survey live url is missing", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJ400",
      code: "SR400",
      surveyLiveUrl: null,
      projectType: "Adhocs",
    });

    const req = new Request(
      "https://test.com/api/projects/PRJ400/survey-live?supplierId=S1&id=EXT1"
    );

    const res = await GET(req, {
      params: Promise.resolve({
        projectId: "PRJ400",
      }),
    });

    expect(res.status).toBe(400);

    const body = await res.json();

    expect(body.error).toContain(
      "Live survey URL is not configured"
    );
  });

  it.each([
    "[identifier]",
    "{identifier}",
    "identifier",
    "",
    "   ",
  ])(
  "does not create tracking records for placeholder externalId %s",
  async (externalId) => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJPH",
      code: "SRPH",
      surveyLiveUrl: "https://client.com/survey",
      projectType: "Adhocs",
    });

    mockPrisma.surveyRedirect.findFirst.mockResolvedValue(null);
    mockPrisma.surveyRedirect.findMany.mockResolvedValue([]);

    mockPrisma.respondent.findUnique.mockResolvedValue(null);
    mockPrisma.respondent.findFirst.mockResolvedValue(null);

    const req = new Request(
      `https://test.com/api/projects/PRJPH/survey-live?supplierId=S1&id=${encodeURIComponent(
        externalId
      )}`
    );

    const res = await GET(req, {
      params: Promise.resolve({
        projectId: "PRJPH",
      }),
    });

    expect(res.status).toBe(302);

    expect(
      mockPrisma.respondent.create
    ).not.toHaveBeenCalled();

    expect(
      mockPrisma.surveyRedirect.create
    ).not.toHaveBeenCalled();

    expect(
      mockPrisma.surveyRedirect.update
    ).not.toHaveBeenCalled();
  }
);

  it("allows Adhoc project without recid", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJADHOC",
      code: "SRADHOC",
      surveyLiveUrl: "https://client.com/survey",
      projectType: "Adhocs",
    });

    mockPrisma.surveyRedirect.findFirst.mockResolvedValue(null);
    mockPrisma.surveyRedirect.findMany.mockResolvedValue([]);

    mockPrisma.respondent.findUnique.mockResolvedValue(null);
    mockPrisma.respondent.findFirst.mockResolvedValue(null);

    const req = new Request(
      "https://test.com/api/projects/PRJADHOC/survey-live?supplierId=S1007&id=EXT001"
    );

    const res = await GET(req, {
      params: Promise.resolve({
        projectId: "PRJADHOC",
      }),
    });

    expect(res.status).toBe(302);
  });

  it("blocks Recontact single-parameter flow when recid is missing", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJREC",
      code: "SRREC",
      surveyLiveUrl: "https://client.com/survey?[identifier]",
      projectType: "Recontact",
    });

    mockPrisma.surveyRedirect.findFirst.mockResolvedValue(null);
    mockPrisma.supplierEntry.findFirst.mockResolvedValue(null);
    mockPrisma.respondent.findFirst.mockResolvedValue(null);

    const req = new Request(
      "https://test.com/api/projects/PRJREC/survey-live?supplierId=S1007&id=EXT001"
    );

    const res = await GET(req, {
      params: Promise.resolve({
        projectId: "PRJREC",
      }),
    });

    expect(res.status).toBe(400);

    expect(
      mockPrisma.respondent.create
    ).not.toHaveBeenCalled();

    expect(
      mockPrisma.surveyRedirect.create
    ).not.toHaveBeenCalled();
  });

  it("blocks reattempt when same recid is reused with a different externalId", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJREC2",
      code: "SRREC2",
      surveyLiveUrl: "https://client.com/survey?[identifier]",
      projectType: "Recontact",
    });

    mockPrisma.surveyRedirect.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "RID1",
        externalId: "OLD001",
        result: "COMPLETE",
      });

    const req = new Request(
      "https://test.com/api/projects/PRJREC2/survey-live?supplierId=S1007&id=NEW001&recid=REC001"
    );

    const res = await GET(req, {
      params: Promise.resolve({
        projectId: "PRJREC2",
      }),
    });

    expect(res.status).toBe(409);

    const body = await res.json();

    expect(body.error).toContain("Survey already attempted");
    expect(body.priorResult).toBe("COMPLETE");

    expect(
      mockPrisma.surveyRedirect.create
    ).not.toHaveBeenCalled();
  });

});
