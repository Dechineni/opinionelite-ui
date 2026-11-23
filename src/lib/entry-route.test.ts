import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/projects/[projectId]/entry/route";
import { requiresDrakoProtection, validateDrakoAccess } from "@/lib/drako/validation";

const mockPrisma = {
  project: {
    findFirst: vi.fn(),
  },

  supplierEntry: {
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock("@/lib/drako/validation", () => ({
  validateDrakoAccess: vi.fn(),
  requiresDrakoProtection: vi.fn(),
}));

const mockedValidateDrakoAccess =
  vi.mocked(validateDrakoAccess);

const mockedRequiresDrakoProtection =
  vi.mocked(requiresDrakoProtection);

describe("entry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedRequiresDrakoProtection.mockResolvedValue(false);

  });

  it("creates supplier entry for valid supplier request", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
    });

    mockPrisma.supplierEntry.upsert.mockResolvedValue({
      id: "ENTRY1",
    });

    const req = new Request(
      "https://test.com/api/projects/PRJ1/entry",
      {
        method: "POST",
        body: JSON.stringify({
          supplierId: "S1007",
          externalId: "EXT001",
        }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({
        projectId: "PRJ1",
      }),
    });

    expect(res.status).toBe(200);

    expect(
      mockPrisma.supplierEntry.upsert
    ).toHaveBeenCalled();

    const upsertCall =
  mockPrisma.supplierEntry.upsert.mock.calls[0][0];

    expect(upsertCall.create.projectId).toBe("PRJ1");
    expect(upsertCall.create.projectCode).toBe("SR1000");
    expect(upsertCall.create.supplierCode).toBe("S1007");
    expect(upsertCall.create.externalId).toBe("EXT001");
    expect(upsertCall.create.entryCount).toBe(1);
    expect(upsertCall.create.currentStage).toBe("ENTERED");
  });

  it("returns 400 when supplierId is missing", async () => {
    const req = new Request(
      "https://test.com/api/projects/PRJ1/entry",
      {
        method: "POST",
        body: JSON.stringify({
          externalId: "EXT001",
        }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({
        projectId: "PRJ1",
      }),
    });

    expect(res.status).toBe(400);

    expect(
      mockPrisma.supplierEntry.upsert
    ).not.toHaveBeenCalled();
  });

  it("returns 400 when externalId is missing", async () => {
    const req = new Request(
      "https://test.com/api/projects/PRJ1/entry",
      {
        method: "POST",
        body: JSON.stringify({
          supplierId: "S1007",
        }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({
        projectId: "PRJ1",
      }),
    });

    expect(res.status).toBe(400);

    expect(
      mockPrisma.supplierEntry.upsert
    ).not.toHaveBeenCalled();
  });

  it("returns 404 when project does not exist", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = new Request(
      "https://test.com/api/projects/PRJ1/entry",
      {
        method: "POST",
        body: JSON.stringify({
          supplierId: "S1007",
          externalId: "EXT001",
        }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({
        projectId: "PRJ1",
      }),
    });

    expect(res.status).toBe(404);

    expect(
      mockPrisma.supplierEntry.upsert
    ).not.toHaveBeenCalled();
  });

  it("stores recid when supplied", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
    });

    mockPrisma.supplierEntry.upsert.mockResolvedValue({
      id: "ENTRY1",
    });

    const req = new Request(
      "https://test.com/api/projects/PRJ1/entry",
      {
        method: "POST",
        body: JSON.stringify({
          supplierId: "S1007",
          externalId: "EXT001",
          recid: "REC001",
        }),
      }
    );

    await POST(req, {
      params: Promise.resolve({
        projectId: "PRJ1",
      }),
    });

    const upsertCall =
      mockPrisma.supplierEntry.upsert.mock.calls[0][0];

    expect(upsertCall.create.projectId).toBe("PRJ1");
    expect(upsertCall.create.projectCode).toBe("SR1000");
    expect(upsertCall.create.supplierCode).toBe("S1007");
    expect(upsertCall.create.externalId).toBe("EXT001");
    expect(upsertCall.create.recid).toBe("REC001");
  });

  it("does not overwrite recid when blank recid is supplied", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
    });

    mockPrisma.supplierEntry.upsert.mockResolvedValue({
      id: "ENTRY1",
    });

    const req = new Request(
      "https://test.com/api/projects/PRJ1/entry",
      {
        method: "POST",
        body: JSON.stringify({
          supplierId: "S1007",
          externalId: "EXT001",
          recid: "",
        }),
      }
    );

    await POST(req, {
      params: Promise.resolve({
        projectId: "PRJ1",
      }),
    });

    const upsertCall =
      mockPrisma.supplierEntry.upsert.mock.calls[0][0];

    expect(upsertCall.update).not.toHaveProperty("recid");
  });

  it.each([
  "[identifier]",
  "{identifier}",
  "identifier",
  "",
  "   ",
])(
  "rejects unusable externalId '%s'",
  async (externalId) => {
    const req = new Request(
      "https://test.com/api/projects/PRJ1/entry",
      {
        method: "POST",
        body: JSON.stringify({
          supplierId: "S1007",
          externalId,
        }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({
        projectId: "PRJ1",
      }),
    });

    expect(res.status).toBe(400);

    expect(
      mockPrisma.supplierEntry.upsert
    ).not.toHaveBeenCalled();
  }
);

  it(
    "blocks invalid drako entry access",
    async () => {
      mockedRequiresDrakoProtection.mockResolvedValue(
        true
      );

      mockedValidateDrakoAccess.mockResolvedValue({
        valid: false,
        status: 403,
        reason: "Traffic disabled",
      } as any);

      const req = new Request(
        "https://test.com/api/projects/PRJ1/entry",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supplierId: "S1010",
            externalId: "ABC123",
          }),
        }
      );

      const res = await POST(req, {
        params: Promise.resolve({
          projectId: "PRJ1",
        }),
      });

      expect(res.status).toBe(403);

      expect(
        mockedValidateDrakoAccess
      ).toHaveBeenCalledWith(
        mockPrisma,
        "PRJ1",
        "S1010"
      );


      expect(
        mockPrisma.supplierEntry.upsert
      ).not.toHaveBeenCalled();
    }
  );
});
