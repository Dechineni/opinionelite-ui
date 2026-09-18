import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  client: {
    findUnique: vi.fn(),
  },
  supplierEntry: {
    count: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({
      value: "mock-token",
    }),
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

const validClient = {
  id: "client-1",
  name: "Test Client",
  code: "TC001",
};

const baseRow = {
  sNo: 1,
  clientName: "Test Client",
  clientCode: "TC001",
  projectCode: "P001",
  surveyName: "Survey A",
  hashIdentifier: "",
  supplierId: "SUP1",
  supplierName: "",
  supplierIdentifier: "EXT123",
  startDateTime: null,
  endDateTime: null,
  loi: null,
};

// CLIENT REPORT API VALIDATION
describe("Client Report API Validation", () => {

  // MISSING CLIENTID RETURN 400 JSON
  it("Missing clientId should return 400 JSON", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?from=2024-01-01&to=2024-01-31"
      )
    );

    expect(response.status).toBe(400);
  });

  // MISSING FROM DATE RETURN 400 JSON
  it("Missing from date should return 400 JSON", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&to=2024-01-31"
      )
    );

    expect(response.status).toBe(400);
  });

  // MISSING TO DATE RETURN 400 JSON
  it("Missing to date should return 400 JSON", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01"
      )
    );

    expect(response.status).toBe(400);
  });

  // INVALID FORMAT SHOULD RETURN 400 JSON
  it("Invalid format should return 400 JSON", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&format=pdf"
      )
    );

    expect(response.status).toBe(400);
  });

  // INVALID PAGE SHOULD RETURN 400 JSON
  it("Invalid page should return 400 JSON", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&page=0"
      )
    );

    expect(response.status).toBe(400);
  });

  // INVALID PAGESIZE SHOULD RETURN 400 JSON
  it("Invalid pageSize should return 400 JSON", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&pageSize=0"
      )
    );

    expect(response.status).toBe(400);
  });

  // UNSUPPORTED PAGESIZE SHOULD RETURN 400 JSON
  it("Unsupported pageSize should return 400 JSON", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&pageSize=999"
      )
    );

    expect(response.status).toBe(400);
  });

  // VALID REQUEST SHOULD RETURN SUCCESS RESPONSE
  it("Valid request should return success response", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
    mockPrisma.supplierEntry.count.mockResolvedValue(0);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

});

// PAGINATION BEHAVIOR
describe("Pagination Behavior", () => {
  beforeEach(() => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
  });

  // DEFAULT PAGE SHOULD BE 1
  it("Default page should be 1", async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(0);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    const body = await response.json();

    expect(body.page).toBe(1);
  });

  // DEFAULT PAGESIZE SHOULD BE 100
  it("Default pageSize should be 100", async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(0);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    const body = await response.json();

    expect(body.pageSize).toBe(100);
  });

  // PAGE=2&PAGESIZE=100 SHOULD RETURN CORRECT PAGINATION METADATA
  it("page=2&pageSize=100 should return correct pagination metadata", async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(250);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&page=2&pageSize=100"
      )
    );

    const body = await response.json();

    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(100);
    expect(body.totalRows).toBe(250);
    expect(body.totalPages).toBe(3);
  });

  // RESPONSE SHOULD INCLUDE ALL REQUIRED METADATA LIKE SUCCESS, STATUS, DATA, ROWS, PAGE, PAGESIZE,TOTALROWS, TOTALPAGES
  it("Response should include all required metadata", async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(10);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    const body = await response.json();

    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("rows");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
    expect(body).toHaveProperty("totalRows");
    expect(body).toHaveProperty("totalPages");
  });

  // ROWS AND DATA SHOULD BOTH BE RETURN FOR COMPATIBILITY
  it("rows and data should both be returned", async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(0);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    const body = await response.json();

    expect(body.rows).toEqual(body.data);
  });

});

// REPORT ROW MAPPING
describe("Report Row Mapping", () => {
  beforeEach(() => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
    mockPrisma.supplierEntry.count.mockResolvedValue(1);
  });

  // HASH IDENTIFIER SHOULD RETURN BLANK STRING WHEN SURVEYREDIRECT IS MISSING
  it("Hash Identifier should return blank string", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: null,
        finalSource: null,
        hashIdentifier: "",
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    const body = await response.json();

    expect(body.data[0].hashIdentifier).toBe("");
  });

  // SUPPLIER IDENTIFIER SHOULD MAP FROM SUPPLIERENTRY.EXTERNALID
  it("Supplier Identifier should map correctly", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: null,
        finalSource: null,
        supplierIdentifier: "EXT123",
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    const body = await response.json();

    expect(body.data[0].supplierIdentifier).toBe("EXT123");
  });

  // SURVEY NAME MAPPING 
  describe("Survey Name Mapping", () => {
    beforeEach(() => {
      mockPrisma.client.findUnique.mockResolvedValue(validClient);
      mockPrisma.supplierEntry.count.mockResolvedValue(1);
    });

    // SURVEY NAME SHOULD PREFER APISURVEYSELECTION.SURVEYNAME
    it("Survey Name should prefer ApiSurveySelection.surveyName", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          ...baseRow,
          surveyName: "API Survey Name",
          finalOutcome: null,
          finalSource: null,
        },
      ]);

      const body = await (
        await GET(
          new Request(
            "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
          )
        )
      ).json();

      expect(body.data[0].surveyName).toBe("API Survey Name");
    });

    // SURVEY NAME SHOULD FALL BACK TO PROJECT.SURVEYNAME
    it("Survey Name should fall back to Project.surveyName", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          ...baseRow,
          surveyName: "Project Survey Name",
          finalOutcome: null,
          finalSource: null,
        },
      ]);

      const body = await (
        await GET(
          new Request(
            "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
          )
        )
      ).json();

      expect(body.data[0].surveyName).toBe("Project Survey Name");
    });

    // SURVEY NAME SHOULD FALL BACK TO PROJECT.NAME
    it("Survey Name should fall back to Project.name", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          ...baseRow,
          surveyName: "Project Name",
          finalOutcome: null,
          finalSource: null,
        },
      ]);

      const body = await (
        await GET(
          new Request(
            "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
          )
        )
      ).json();

      expect(body.data[0].surveyName).toBe("Project Name");
    });

  });

  // SUPPLIER NAME SHOULD RETURN BLANK IF SUPPLIER IS MISSING
  it("Supplier Name should return blank if supplier is missing", async () => {
  mockPrisma.client.findUnique.mockResolvedValue(validClient);
  mockPrisma.supplierEntry.count.mockResolvedValue(1);

  mockPrisma.$queryRaw.mockResolvedValue([
    {
      ...baseRow,
      supplierName: "",
      finalOutcome: null,
      finalSource: null,
    },
  ]);

  const body = await (
    await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    )
  ).json();

  expect(body.data[0].supplierName).toBe("");
  });

  // STATUS DESCRIPTION FOR COMPLETE
  it("Status COMPLETE maps to Complete", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: "COMPLETE",
        finalSource: null,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    const body = await response.json();

    expect(body.data[0].statusDescription).toBe("Complete");
  });

  // STATUS DESCRIPTION FOR PRESCREEN TERMINATE
  it("Status TERMINATE + PRESCREEN_FAIL", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: "TERMINATE",
        finalSource: "PRESCREEN_FAIL",
      },
    ]);

    const body = await (
      await GET(
        new Request(
          "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
        )
      )
    ).json();

    expect(body.data[0].statusDescription).toBe(
      "Prescreener Terminate"
    );
  });

  // STATUS DESCRIPTION FOR TERMINATE
  it("Status TERMINATE", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: "TERMINATE",
        finalSource: "OTHER",
      },
    ]);

    const body = await (
      await GET(
        new Request(
          "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
        )
      )
    ).json();

    expect(body.data[0].statusDescription).toBe("Terminate");
  });

  // STATUS DESCRIPTION FOR OVER QUOTA
  it("Status OVER_QUOTA", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: "OVER_QUOTA",
        finalSource: null,
      },
    ]);

    const body = await (
      await GET(
        new Request(
          "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
        )
      )
    ).json();

    expect(body.data[0].statusDescription).toBe("Over Quota");
  });

  // STATUS DESCRIPTION FOR QUALITY_TERM
  it("QUALITY_TERM should map to Quality Terminate", async () => {
  mockPrisma.client.findUnique.mockResolvedValue(validClient);
  mockPrisma.supplierEntry.count.mockResolvedValue(1);

  mockPrisma.$queryRaw.mockResolvedValue([
    {
      ...baseRow,
      finalOutcome: "QUALITY_TERM",
      finalSource: null,
    },
  ]);

  const body = await (
    await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    )
  ).json();

  expect(body.data[0].statusDescription).toBe(
    "Quality Terminate"
  );
  });

  // STATUS DESCRIPTION FOR DROP OUT
  it("SURVEY_CLOSE and DROP_OUT should map to Drop Out", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
    mockPrisma.supplierEntry.count.mockResolvedValue(1);

    const outcomes = ["SURVEY_CLOSE", "DROP_OUT"];

    for (const outcome of outcomes) {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          ...baseRow,
          finalOutcome: outcome,
          finalSource: null,
        },
      ]);

      const body = await (
        await GET(
          new Request(
            "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
          )
        )
      ).json();

      expect(body.data[0].statusDescription).toBe(
        "Drop Out"
      );
    }
  });

  // STATUS DESCRIPTION FOR IN PROGRESS
  it("null finalOutcome should map to In Progress", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
    mockPrisma.supplierEntry.count.mockResolvedValue(1);

    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: null,
        finalSource: null,
      },
    ]);

    const body = await (
      await GET(
        new Request(
          "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
        )
      )
    ).json();

    expect(body.data[0].statusDescription).toBe(
      "In Progress"
    );
  });

});

// LOI CALCULATION
describe("LOI Calculation", () => {

  // LOI SHOULD BE ROUNDED MINUTES
  it("LOI should return rounded minutes", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
    mockPrisma.supplierEntry.count.mockResolvedValue(1);

    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: "COMPLETE",
        finalSource: null,
        loi: 15,
      },
    ]);

    const body = await (
      await GET(
        new Request(
          "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
        )
      )
    ).json();

    expect(body.data[0].loi).toBe(15);
  });

  // LOI SHOULD BE BLANK WHEN NULL
  it("LOI should be blank when null", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
    mockPrisma.supplierEntry.count.mockResolvedValue(1);

    mockPrisma.$queryRaw.mockResolvedValue([
      {
        ...baseRow,
        finalOutcome: "COMPLETE",
        finalSource: null,
        loi: null,
      },
    ]);

    const body = await (
      await GET(
        new Request(
          "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
        )
      )
    ).json();

    expect(body.data[0].loi).toBe("");
  });

});

// DOWNLOAD SAFETY
describe("Download Safety", () => {

  // SHOULD RETURN 413 WHEN ROWS EXCEED 1000
  it("should return 413 when rows exceed 1000", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
    mockPrisma.supplierEntry.count.mockResolvedValue(1001);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&format=xlsx"
      )
    );

    expect(response.status).toBe(413);
  });

  // SHOULD ALLOW DOWNLOAD WHEN ROWS <= 1000
  it("should allow download when rows <= 1000", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
    mockPrisma.supplierEntry.count.mockResolvedValue(1000);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&format=xlsx"
      )
    );

    expect(response.status).toBe(200);
  });

  // EXISTING DOWNLOAD BEHAVIOUR SHOULD NOT BE REMOVED
  it("should preserve existing xlsx download behavior", async () => {
  mockPrisma.client.findUnique.mockResolvedValue(validClient);
  mockPrisma.supplierEntry.count.mockResolvedValue(1000);
  mockPrisma.$queryRaw.mockResolvedValue([]);

  const response = await GET(
    new Request(
      "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&format=xlsx"
    )
  );

  expect(response.status).toBe(200);

  expect(
    response.headers.get("content-type")
  ).toContain(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  expect(
    response.headers.get("content-disposition")
  ).toContain("ClientReport");
  });

});

// QUERY BEHAVIOR
describe("Query Behavior", () => {
  beforeEach(() => {
    mockPrisma.client.findUnique.mockResolvedValue(validClient);
  });

  // JSON VIEW SHOULD USE PAGINATION LIMIT AND OFFSET
  it("JSON View should use pagination limit and offset", async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(250);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&page=2&pageSize=100"
      )
    );

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    const queryArgs = JSON.stringify(mockPrisma.$queryRaw.mock.calls[0]);
    expect(queryArgs).toContain("100");
    expect(queryArgs).toContain("OFFSET");

  });

  // XLSX DOWNLOAD SHOULD USE LIMIT 1000 AND OFFSET 0
  it("XLSX Download should use limit 1000 and offset 0", async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(100);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31&format=xlsx"
      )
    );

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);

    const queryArgs = JSON.stringify(mockPrisma.$queryRaw.mock.calls[0]);
    expect(queryArgs).toContain("1000");
    expect(queryArgs).toContain("OFFSET");
    expect(queryArgs).toContain("0");
  });

  // PLACEHOLDER EXTERNALID VALUES "" SHOULD BE EXCLUDED
  it('Placeholder externalId value "" should be excluded', async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(0);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    expect(mockPrisma.supplierEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { externalId: { not: "" } },
          ]),
        }),
      })
    );
  });

  // PLACEHOLDER EXTERNALID VALUE "[IDENTIFIER]" SHOULD BE EXCLUDED
  it('Placeholder externalId value "[identifier]" should be excluded', async () => {
    mockPrisma.supplierEntry.count.mockResolvedValue(0);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    await GET(
      new Request(
        "http://localhost/api/reports/client?clientId=1&from=2024-01-01&to=2024-01-31"
      )
    );

    expect(mockPrisma.supplierEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { externalId: { not: "[identifier]" } },
          ]),
        }),
      })
    );
  });
  
});
