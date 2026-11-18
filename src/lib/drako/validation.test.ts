import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requiresDrakoValidation,
  validateDrakoAccess,
} from "./validation";

vi.mock("@/lib/drako/server", () => ({
  isDrakoSupplier: vi.fn(),
}));

import { isDrakoSupplier } from "@/lib/drako/server";

const mockedIsDrakoSupplier =
  vi.mocked(isDrakoSupplier);

describe("requiresDrakoValidation", () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      supplier: {
        findUnique: vi.fn(),
      },
    };
  });

  it("returns false when supplier code is empty", async () => {
    const result =
      await requiresDrakoValidation(
        prisma,
        ""
      );

    expect(result).toBe(false);

    expect(
      prisma.supplier.findUnique
    ).not.toHaveBeenCalled();
  });

  it("returns false when supplier is not found", async () => {
    prisma.supplier.findUnique.mockResolvedValue(
      null
    );

    const result =
      await requiresDrakoValidation(
        prisma,
        "S1010"
      );

    expect(result).toBe(false);
  });

  it("returns false for non drako supplier", async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      code: "S1007",
    });

    mockedIsDrakoSupplier.mockReturnValue(
      false
    );

    const result =
      await requiresDrakoValidation(
        prisma,
        "S1007"
      );

    expect(result).toBe(false);
  });

  it("returns true for drako supplier", async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      code: "S1010",
    });

    mockedIsDrakoSupplier.mockReturnValue(
      true
    );

    const result =
      await requiresDrakoValidation(
        prisma,
        "S1010"
      );

    expect(result).toBe(true);
  });
});

describe("validateDrakoAccess", () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      project: {
        findFirst: vi.fn(),
      },

      supplier: {
        findUnique: vi.fn(),
      },

      projectSupplierMap: {
        findUnique: vi.fn(),
      },
    };
  });

  it("returns 404 when project is not found", async () => {
    prisma.project.findFirst.mockResolvedValue(
      null
    );

    const result =
      await validateDrakoAccess(
        prisma,
        "PRJ1",
        "S1010"
      );

    expect(result).toEqual({
      valid: false,
      status: 404,
      reason: "Project not found",
    });
  });

  it("returns 404 when supplier is not found", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
      status: "ACTIVE",
      projectType: "Adhocs",
      startDate: null,
      endDate: null,
    });

    prisma.supplier.findUnique.mockResolvedValue(
      null
    );

    const result =
      await validateDrakoAccess(
        prisma,
        "PRJ1",
        "S1010"
      );

    expect(result).toEqual({
      valid: false,
      status: 404,
      reason: "Supplier not found",
    });
  });

  it("returns 403 when supplier is not drako", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
      status: "ACTIVE",
      projectType: "Adhocs",
      startDate: null,
      endDate: null,
    });

    prisma.supplier.findUnique.mockResolvedValue({
      id: "SUP1",
      code: "S1007",
    });

    mockedIsDrakoSupplier.mockReturnValue(
      false
    );

    const result =
      await validateDrakoAccess(
        prisma,
        "PRJ1",
        "S1007"
      );

    expect(result).toEqual({
      valid: false,
      status: 403,
      reason: "Supplier is not DRAKO",
    });
  });

  it("returns 403 when mapping is missing", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
      status: "ACTIVE",
      projectType: "Adhocs",
      startDate: null,
      endDate: null,
    });

    prisma.supplier.findUnique.mockResolvedValue({
      id: "SUP1",
      code: "S1010",
    });

    mockedIsDrakoSupplier.mockReturnValue(
      true
    );

    prisma.projectSupplierMap.findUnique.mockResolvedValue(
      null
    );

    const result =
      await validateDrakoAccess(
        prisma,
        "PRJ1",
        "S1010"
      );

    expect(result).toEqual({
      valid: false,
      status: 403,
      reason: "Mapping missing",
    });
  });

  it("returns 403 when traffic is disabled", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
      status: "ACTIVE",
      projectType: "Adhocs",
      startDate: null,
      endDate: null,
    });

    prisma.supplier.findUnique.mockResolvedValue({
      id: "SUP1",
      code: "S1010",
    });

    mockedIsDrakoSupplier.mockReturnValue(
      true
    );

    prisma.projectSupplierMap.findUnique.mockResolvedValue({
      allowTraffic: false,
    });

    const result =
      await validateDrakoAccess(
        prisma,
        "PRJ1",
        "S1010"
      );

    expect(result).toEqual({
      valid: false,
      status: 403,
      reason: "Traffic disabled",
    });
  });

  it("returns success for a valid drako mapping", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "PRJ1",
      code: "SR1000",
      status: "ACTIVE",
      projectType: "Adhocs",
      startDate: null,
      endDate: null,
    });

    prisma.supplier.findUnique.mockResolvedValue({
      id: "SUP1",
      code: "S1010",
    });

    mockedIsDrakoSupplier.mockReturnValue(
      true
    );

    prisma.projectSupplierMap.findUnique.mockResolvedValue({
      allowTraffic: true,
    });

    const result =
      await validateDrakoAccess(
        prisma,
        "PRJ1",
        "S1010"
      );

    expect(result.valid).toBe(true);
  });

    it("returns 403 when project is not active", async () => {
        prisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
            code: "SR1000",
            status: "DRAFT",
            projectType: "Adhocs",
            startDate: null,
            endDate: null,
        });

        const result =
            await validateDrakoAccess(
                prisma,
                "PRJ1",
                "S1010"
            );

        expect(result).toEqual({
            valid: false,
            status: 403,
            reason: "Project is not active",
        });
    });

    it("returns 403 for recontact projects", async () => {
        prisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
            code: "SR1000",
            status: "ACTIVE",
            projectType: "Recontact",
            startDate: null,
            endDate: null,
        });

        const result =
            await validateDrakoAccess(
                prisma,
                "PRJ1",
                "S1010"
            );

        expect(result).toEqual({
            valid: false,
            status: 403,
            reason: "Recontact not supported",
        });
    });
});