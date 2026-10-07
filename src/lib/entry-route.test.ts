import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/projects/[projectId]/entry/route";

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

describe("entry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(
      mockPrisma.supplierEntry.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          recid: "REC001",
        }),
      })
    );
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


});
