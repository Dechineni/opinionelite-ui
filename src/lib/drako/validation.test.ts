import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateDrakoAccess } from "./validation";
import { isDrakoSupplier } from "@/lib/drako/server";

vi.mock("@/lib/drako/server", () => ({
  isDrakoSupplier: vi.fn(),
}));

// DRAKO VALIDATIONS
describe("validateDrakoAccess", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // VERIFY MSIIING PROJECT IS REJECTED 
    it("returns 404 when project is not found", async () => {

        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue(null),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "DRAKO"
        );

        expect(result).toEqual({
        valid: false,
        status: 404,
        reason: "Project not found",
        });
    });

    // VERIFY RECONTACT PROJECTS ARE NOT SUPPORTED  
    it("rejects recontact projects", async () => {

        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue({
            id: "project-1",
            code: "PROJECT1",
            status: "ACTIVE",
            projectType: "Recontact",
            startDate: null,
            endDate: null,
            }),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "DRAKO"
        );

        expect(result).toEqual({
        valid: false,
        status: 403,
        reason: "Recontact not supported",
        });
    });

    // VERIFY INACTIVE PROJECTS ARE REJECTED   
    it("rejects inactive projects", async () => {

        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue({
            id: "project-1",
            code: "PROJECT1",
            status: "PAUSED",
            projectType: "GENERAL",
            startDate: null,
            endDate: null,
            }),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "DRAKO"
        );

        expect(result).toEqual({
        valid: false,
        status: 403,
        reason: "Project is not active",
        });
    });

    // VERIFY PROJECT START DATE RESTRICTION 
    it("rejects projects before start date", async () => {

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue({
            id: "project-1",
            code: "PROJECT1",
            status: "ACTIVE",
            projectType: "GENERAL",
            startDate: futureDate,
            endDate: null,
            }),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "DRAKO"
        );

        expect(result).toEqual({
        valid: false,
        status: 403,
        reason: "Project not started",
        });
    });

    // VERIFY PROJECT END DATE RESTRICTION  
    it("rejects closed projects", async () => {

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const prisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          id: "project-1",
          code: "PROJECT1",
          status: "ACTIVE",
          projectType: "GENERAL",
          startDate: null,
          endDate: pastDate,
        }),
      },
    };

    const result = await validateDrakoAccess(
      prisma,
      "PROJECT1",
      "DRAKO"
    );

    expect(result).toEqual({
      valid: false,
      status: 403,
      reason: "Project closed",
    });
    });

    // VERIFY MISSING SUPPLIER IS REJECTED   
    it("returns 404 when supplier is not found", async () => {
        
        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue({
            id: "project-1",
            code: "PROJECT1",
            status: "ACTIVE",
            projectType: "GENERAL",
            startDate: null,
            endDate: null,
            }),
        },
        supplier: {
            findUnique: vi.fn().mockResolvedValue(null),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "DRAKO"
        );

        expect(result).toEqual({
        valid: false,
        status: 404,
        reason: "Supplier not found",
        });
    });

    // VERIFY ONLY DRAKO SUPPLIER ARE ALLOWED  
    it("rejects non drako suppliers", async () => {

        vi.mocked(isDrakoSupplier).mockReturnValue(false);

        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue({
            id: "project-1",
            code: "PROJECT1",
            status: "ACTIVE",
            projectType: "GENERAL",
            startDate: null,
            endDate: null,
            }),
        },
        supplier: {
            findUnique: vi.fn().mockResolvedValue({
            id: "supplier-1",
            code: "TEST",
            }),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "TEST"
        );

        expect(result).toEqual({
        valid: false,
        status: 403,
        reason: "Supplier is not DRAKO",
        });
    });

    // VERIFY MAPPING MUST EXIST   
    it("rejects missing mapping", async () => {

        vi.mocked(isDrakoSupplier).mockReturnValue(true);

        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue({
            id: "project-1",
            code: "PROJECT1",
            status: "ACTIVE",
            projectType: "GENERAL",
            startDate: null,
            endDate: null,
            }),
        },
        supplier: {
            findUnique: vi.fn().mockResolvedValue({
            id: "supplier-1",
            code: "DRAKO",
            }),
        },
        projectSupplierMap: {
            findUnique: vi.fn().mockResolvedValue(null),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "DRAKO"
        );

        expect(result).toEqual({
        valid: false,
        status: 403,
        reason: "Mapping missing",
        });
    });

    // VERIFY TRAFFIC DISABLED MAPPING IS REJECTED   
    it("rejects disabled mapping", async () => {

        vi.mocked(isDrakoSupplier).mockReturnValue(true);

        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue({
            id: "project-1",
            code: "PROJECT1",
            status: "ACTIVE",
            projectType: "GENERAL",
            startDate: null,
            endDate: null,
            }),
        },
        supplier: {
            findUnique: vi.fn().mockResolvedValue({
            id: "supplier-1",
            code: "DRAKO",
            }),
        },
        projectSupplierMap: {
            findUnique: vi.fn().mockResolvedValue({
            allowTraffic: false,
            }),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "DRAKO"
        );

        expect(result).toEqual({
        valid: false,
        status: 403,
        reason: "Traffic disabled",
        });
    });

    // VERIFY VALID DRAKO REQUEST SUCCEEDS   
    it("returns success for valid drako access", async () => {

        vi.mocked(isDrakoSupplier).mockReturnValue(true);

        const project = {
        id: "project-1",
        code: "PROJECT1",
        status: "ACTIVE",
        projectType: "GENERAL",
        startDate: null,
        endDate: null,
        };

        const supplier = {
        id: "supplier-1",
        code: "DRAKO",
        };

        const prisma = {
        project: {
            findFirst: vi.fn().mockResolvedValue(project),
        },
        supplier: {
            findUnique: vi.fn().mockResolvedValue(supplier),
        },
        projectSupplierMap: {
            findUnique: vi.fn().mockResolvedValue({
            allowTraffic: true,
            }),
        },
        };

        const result = await validateDrakoAccess(
        prisma,
        "PROJECT1",
        "DRAKO"
        );

        expect(result).toEqual({
        valid: true,
        drako: true,
        project,
        supplier,
        });
    });

});