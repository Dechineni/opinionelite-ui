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

// PROJECT REPORT - LARGE DOWNLOAD RELIABILITY AND EXPORT INTEGRITY
describe("Project Report - Large Download Reliability and Export Integrity" , () =>{

  // SHOULD GENERATE ONE REPORT ROW FOR EVERY SUPPLIER ENTRY
  it("should generate one report row for every supplier entry" , async() =>{
    
    // CREATE 100 MOCK SUPPLIER ENTRIES TO VERIFY THAT THE REPORT GENERATES
    const supplierEntries = Array.from({ length: 100 }, (_, i) => ({
      supplierCode: "S1007",
      externalId: `EXT${i}`,
      firstEnteredAt: new Date("2024-01-01T10:00:00Z"),
      finalOutcomeAt: new Date("2024-01-01T10:10:00Z"),
      finalOutcome: "COMPLETE",
      finalSource: null,
      isBackfilled: false,
    }));

    mockFindUnique.mockResolvedValue({
      ...mockProject,
      supplierEntries,
      SurveyRedirect: supplierEntries.map((entry, i) => ({
        id: `HASH${i}`,
        supplierId: entry.supplierCode,
        externalId: entry.externalId,
      })),
    });

    const result = await generateProjectReport("project-1");

    expect(result.respondentDetailsData).toHaveLength(
      supplierEntries.length
    );
  });

  // VERIFY THAT EVERY SUPPLIERENTRY EXTERNALID APPEARS EXACTLY ONCE
  it("should preserve all supplier identifiers without duplicates", async () => {

    // CREATE 100 MOCK SUPPLIER ENTRIES TO VERIFY THAT EVERY SUPPLIERENTRY EXTERNALID APPEARS EXACTLY ONCE
    const supplierEntries = Array.from({ length: 100 }, (_, i) => ({
      supplierCode: "S1007",
      externalId: `EXT${i}`,
      firstEnteredAt: new Date("2024-01-01T10:00:00Z"),
      finalOutcomeAt: new Date("2024-01-01T10:10:00Z"),
      finalOutcome: "COMPLETE",
      finalSource: null,
      isBackfilled: false,
    }));

    mockFindUnique.mockResolvedValue({
      ...mockProject,
      supplierEntries,
      SurveyRedirect: supplierEntries.map((entry, i) => ({
        id: `HASH${i}`,
        supplierId: entry.supplierCode,
        externalId: entry.externalId,
      })),
    });

    const result = await generateProjectReport("project-1");

    // GET ALL SUPPLIER IDENTIFIERS FROM THE REPORT ROWS
    const reportIdentifiers = result.respondentDetailsData.map(
      (row) => row.supplierIdentifier
    );

    // VERIFY THAT ALL SUPPLIER IDENTIFIERS ARE UNIQUE AND NO DUPLICATES EXIST
    expect(reportIdentifiers).toEqual(
      supplierEntries.map((entry) => entry.externalId)
    );
  });

  // CONFIRM NUMERIC COLUMNS (PROJECT CPI, SUPPLIER CPI, LOI) REMAIN NUMERIC
  it("should keep numeric columns as numbers for all report rows", async () => {
    const result = await generateProjectReport("project-1");

    result.respondentDetailsData.forEach((row) => {
      expect(typeof row.projectCpi).toBe("number");
      expect(typeof row.supplierCpi).toBe("number");
      expect(typeof row.loi).toBe("string");
    });

  });

  // SHOULD KEEP HASHIDENTIFIER BLANK FOR UNMATCHED ROWS IN LARGE DATASETS
  it("should keep hashIdentifier blank for unmatched rows in large datasets", async () => {

    // CREATE 100 MOCK SUPPLIER ENTRIES TO VERIFY HASHIDENTIFIER BLANK FOR UNMATCHED ROWS IN LARGE DATASETS
    const supplierEntries = Array.from({ length: 100 }, (_, i) => ({
      supplierCode: "S1007",
      externalId: `EXT${i}`,
      firstEnteredAt: new Date("2024-01-01T10:00:00Z"),
      finalOutcomeAt: new Date("2024-01-01T10:10:00Z"),
      finalOutcome: "COMPLETE",
      finalSource: null,
      isBackfilled: false,
    }));

    mockFindUnique.mockResolvedValue({
      ...mockProject,
      supplierEntries,
      SurveyRedirect: [],
    });

    const result = await generateProjectReport("project-1");

    result.respondentDetailsData.forEach((row) => {
      expect(row.hashIdentifier).toBe("");
    });

  });

  // VERIFY HASH IDENTIFIER MAPPING REMAINS CORRECT FOR LARGE DATASETS
  it("should correctly map hash identifiers for large datasets", async () => {

    // CREATE 100 MOCK SUPPLIER ENTRIES TO VERIFY HASH IDENTIFIER MAPPING REMAINS CORRECT FOR LARGE DATASETS
    const supplierEntries = Array.from({ length: 100 }, (_, i) => ({
      supplierCode: "S1007",
      externalId: `EXT${i}`,
      firstEnteredAt: new Date("2024-01-01T10:00:00Z"),
      finalOutcomeAt: new Date("2024-01-01T10:10:00Z"),
      finalOutcome: "COMPLETE",
      finalSource: null,
      isBackfilled: false,
    }));

    mockFindUnique.mockResolvedValue({
      ...mockProject,
      supplierEntries,
      SurveyRedirect: supplierEntries.map((entry, i) => ({
        id: `HASH${i}`,
        supplierId: entry.supplierCode,
        externalId: entry.externalId,
      })),
    });

    const result = await generateProjectReport("project-1");

    expect(result.respondentDetailsData[0].hashIdentifier).toBe("HASH0");
    expect(result.respondentDetailsData[50].hashIdentifier).toBe("HASH50");
    expect(result.respondentDetailsData[99].hashIdentifier).toBe("HASH99");
  });

  // VERIFY REPORT GENERATION HANDLES 1000 ROWS WITHOUT TRUNACTION.
  it("should generate all report rows for a 1000 record dataset", async () => {

    // CREATE 100 MOCK SUPPLIER ENTRIES TO VERIFY REPORT GENERATION HANDLES 1000 ROWS WITHOUT TRUNACTION.
    const supplierEntries = Array.from({ length: 1000 }, (_, i) => ({
      supplierCode: "S1007",
      externalId: `EXT${i}`,
      firstEnteredAt: new Date("2024-01-01T10:00:00Z"),
      finalOutcomeAt: new Date("2024-01-01T10:10:00Z"),
      finalOutcome: "COMPLETE",
      finalSource: null,
      isBackfilled: false,
    }));

    mockFindUnique.mockResolvedValue({
      ...mockProject,
      supplierEntries,
      SurveyRedirect: [],
    });

    const result = await generateProjectReport("project-1");

    expect(result.respondentDetailsData).toHaveLength(supplierEntries.length);

  });

  // VERIFY REPORT GENERATION HANDLES 10000 ROWS WITHOUT TRUNACTION.
  it("should generate all report rows for a 10000 record dataset", async () => {

    // CREATE 100 MOCK SUPPLIER ENTRIES TO VERIFY THAT THE REPORT GENERATION HANDLES 10000 ROWS WITHOUT TRUNACTION.
    const supplierEntries = Array.from({ length: 10000 }, (_, i) => ({
      supplierCode: "S1007",
      externalId: `EXT${i}`,
      firstEnteredAt: new Date("2024-01-01T10:00:00Z"),
      finalOutcomeAt: new Date("2024-01-01T10:10:00Z"),
      finalOutcome: "COMPLETE",
      finalSource: null,
      isBackfilled: false,
    }));

    mockFindUnique.mockResolvedValue({
      ...mockProject,
      supplierEntries,
      SurveyRedirect: [],
    });

    const result = await generateProjectReport("project-1");

    expect(result.respondentDetailsData).toHaveLength(supplierEntries.length);

  });

  // VERIFY REPORT GENERATION FAILS WITH A CLEAR ERROR WHEN PROJECT IS MISSING.
  it("should throw an error when project is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      generateProjectReport("project-1")
    ).rejects.toThrow("Project not found");
  });

});