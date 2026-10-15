import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateProjectReport } from "./project-report";

// MOCK PROJECT DATA
const mockProject = {
  name: "Test Project",
  code: "PRJ001",
  projectCpi: 10,
  managerEmail: "test@test.com",

  SurveyRedirect: [
    {
      id: "HASH123",
      supplierId: "S1007",
      externalId: "EXT001",
    },
  ],

  supplierEntries: [
    {
      supplierCode: "S1007",
      externalId: "EXT001",
      firstEnteredAt: new Date("2024-01-01T10:00:00Z"),
      finalOutcomeAt: new Date("2024-01-01T10:10:00Z"),
      finalOutcome: "COMPLETE",
      finalSource: null,
      isBackfilled: false,
    },
  ],

  supplierMappings: [
    {
      cpi: 5,
      supplier: {
        id: "SUP1",
        code: "S1007",
        name: "Supplier A",
      },
    },
  ],
};

// MOCK SUPPLIER DATA
const mockSuppliers = [
  {
    code: "S1007",
    name: "Supplier A",
  },
];

// MOCK FOR PRISMA.PROJECT.FINDUNIQUE()
const mockFindUnique = vi.fn();
// MOCK FOR PRISMA.SUPPLIER.FINDMANY()
const mockFindMany = vi.fn();

// RETURN MOCK PRISMA INSTEAD OF CONNECTING TO THE REAL DATABASE
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    project: {
      findUnique: mockFindUnique,
    },
    supplier: {
      findMany: mockFindMany,
    },
  }),
}));

// RESET MOCKS AND RETURN DEFAULT TEST DATA
beforeEach(() => {
  vi.clearAllMocks();

  mockFindUnique.mockResolvedValue(mockProject);
  mockFindMany.mockResolvedValue(mockSuppliers);
});

// PROJECT REPORT - HASH IDENTIFIER AUTOMATED TEST COVERAGE
describe("Project Report - Hash Identifier" , () => {

    // HASH IDENTIFIER MAPPING SUPPLIERIDENTIFIER = ENTRY.EXTERNALID HASHIDENTIFIER = MATCHING SURVEYREDIRECT.ID
    it("Hash Identifier mapping" , async() => {
        const result = await generateProjectReport("project-1");

        const row = result.respondentDetailsData[0];

        expect(row.supplierIdentifier).toBe("EXT001");
        expect(row.hashIdentifier).toBe("HASH123");
    });

    // TEST THAT WHEN A SUPPLIERENTRY DOES NOT HAVE A MATCHNING SURVEYREDIRECT, THE REPORT ROW KEEPS : HASHIDENTIFIER = ""
    it("Missing SurveyRedirect fallback", async () => {
        mockFindUnique.mockResolvedValue({
            ...mockProject,
            SurveyRedirect: [],
        });

        const result = await generateProjectReport("project-1");

        const row = result.respondentDetailsData[0];

        expect(row.hashIdentifier).toBe("");
    });

    // VERIFY MATCHING REQUIRES BOTH SUPPLIERID AND EXTERNALID
    it("verify matching requires both supplierid and externalId", async () => {
        mockFindUnique.mockResolvedValue({
            ...mockProject,
            SurveyRedirect: [
            {
                id: "HASH999",
                supplierId: "S1007",
                externalId: "EXT002",
            },
            ],
        });

        const result = await generateProjectReport("project-1");

        const row = result.respondentDetailsData[0];

        expect(row.hashIdentifier).toBe("");
    });

    // TEST THAT SURVEYREDIRECT MATCHING USES SUPPLIERID + EXTERNALID, SO THE REPORT DOES NOT PICK A SURVEYREDIRECT FROM A DIFFERENT SUPPLIER OR DIFFERENT RESPONDENT.
    it("Matching should be scoped correctly", async () => {
        mockFindUnique.mockResolvedValue({
            ...mockProject,
            SurveyRedirect: [
            {
                id: "HASH999",
                supplierId: "S1008",
                externalId: "EXT001",
            },
            ],
        });

        const result = await generateProjectReport("project-1");

        const row = result.respondentDetailsData[0];

        expect(row.hashIdentifier).toBe("");
    });

    // TEST THAT SUPPLIER IDENTIFIER STILL COMES FROM SUPPLIERENTRY.EXTERNALID AND IS NOT REPLACED BY SURVEYREDIRECT.ID.
    it("keeps supplier identifier mapped from externalId", async () => {
        const result = await generateProjectReport("project-1");

        const row = result.respondentDetailsData[0];

        expect(row.supplierIdentifier).toBe("EXT001");
        expect(row.supplierIdentifier).not.toBe("HASH123");
    });

    // ADD TEST COVERAGE, WHERE PRACTICAL, TO VERIFY THE RESPONDENT DETAILS COLUMN ORDER REMAINS : S.NO, SUPPLIER ID, SUPPLIER NAME, SUPPLIER IDENTIFIER,
    // HASH IDENTIFIER, PROJECT CPI, SUPPLIER CPI, STATUS DESCRIPTION, START DATE TIME, END DATE TIME, LOI.
    it("maintains respondent details column order", async () => {
        const result = await generateProjectReport("project-1");

        const row = result.respondentDetailsData[0];

        expect(Object.keys(row)).toEqual([
            "serialNo",
            "supplierId",
            "supplierName",
            "supplierIdentifier",
            "hashIdentifier",
            "projectCpi",
            "supplierCpi",
            "statusDescription",
            "startDateTime",
            "endDateTime",
            "loi",
        ]);
    });

});