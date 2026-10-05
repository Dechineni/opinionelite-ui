import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/Thanks/Index/route";

// MOCK PRISMA SO TESTS DO NOT CONNECT TO THE REAL DATABASE
const mockPrisma = vi.hoisted(() => ({
    // MOCK SURVEYREDIRECT DATABASE OPERATIONS
    surveyRedirect: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
    },

    // MOCK SUPPLIERENTRY DATABASE OPERATIONS
    supplierEntry: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
    },

    // MOCK PROJECT DATABASE OPERATIONS
    project: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
    },

    // MOCK SUPPLIER DATABASE OPERATIONS
    supplier: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
    },

    respondent: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
    },

    supplierRedirectEvent: {
        create: vi.fn(),
    },

}));

// RETURN MOCK PRISMA INSTEAD OF CONNECTING TO THE REAL DATABASE
vi.mock("@/lib/prisma", () => ({
    getPrisma: vi.fn(() => mockPrisma),
}));

// AUTH STATUS MAPPING
describe("Thanks/Index - auth status mapping", () => {

    // PID VALUE FOR TESTING PURPOSE
    const pid = "12345678901234567890";

    // MOCK SURVEY REDIRECT DATA FOR AUTH STATUS TESTING
    beforeEach(() => {
        vi.clearAllMocks();

        mockPrisma.surveyRedirect.findUnique.mockResolvedValue({
            id: pid,
            projectId: null,
            supplierId: null,
            respondentId: null,
            externalId: null,
            destination: null,
            result: null,
            recid: null,
        });

        mockPrisma.surveyRedirect.update.mockResolvedValue({});
    });

    // SHOULD UPDATE SURVEYREDIRECT RESULT TO COMPLETE WHEN AUTH = 10 
    it("auth=10 should update SurveyRedirect result to COMPLETE", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&pid=${pid}`
        );

        const response = await GET(request);

        expect(mockPrisma.surveyRedirect.update).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "COMPLETE",
            },
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toContain(
            "status=COMPLETE"
        );
    });

    // SHOULD UPDATE SURVEYREDIRECT RESULT TO TERMINATE WHEN AUTH = 20
    it("auth=20 should update SurveyRedirect result to TERMINATE", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=20&pid=${pid}`
        );

        const response = await GET(request);

        expect(mockPrisma.surveyRedirect.update).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "TERMINATE",
            },
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toContain(
            "status=TERMINATE"
        );
    });

    // SHOULD UPDATE SURVEYREDIRECT RESULT TO QUALITY_TERM WHEN AUTH = 30
    it("auth=30 should update SurveyRedirect result to QUALITY_TERM", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=30&pid=${pid}`
        );

        const response = await GET(request);

        expect(mockPrisma.surveyRedirect.update).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "QUALITYTERM",
            },
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toContain(
            "status=QUALITYTERM"
        );
    });

    // SHOULD UPDATE SURVEYREDIRECT RESULT TO OVER_QUOTA WHEN AUTH = 40
    it("auth=40 should update SurveyRedirect result to OVER_QUOTA", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=40&pid=${pid}`
        );

        const response = await GET(request);

        expect(mockPrisma.surveyRedirect.update).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "OVERQUOTA",
            },
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toContain(
            "status=OVERQUOTA"
        );
    });

    // SHOULD UPDATE SURVEYREDIRECT RESULT TO SURVEY_CLOSE WHEN AUTH = 70
    it("auth=70 should update SurveyRedirect result to SURVEY_CLOSE", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=70&pid=${pid}`
        );

        const response = await GET(request);

        expect(mockPrisma.surveyRedirect.update).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "CLOSE",
            },
        });

        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toContain(
            "status=CLOSE"
        );
    });

    // SHOULD FOLLOW EXISTING ROUTE BEHAVIOR WHEN AUTH VALUE IS UNKNOWN
    it("unknown auth should return 400 and not update SurveyRedirect", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=999&pid=${pid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(400);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(await response.json()).toEqual({
            ok: false,
            error: "Invalid or missing auth",
        });
    });

    // SHOULD FOLLOW EXISTING ROUTE BEHAVIOR WHEN AUTH VALUE IS MISSING
    it("missing auth should return 400 and not update SurveyRedirect", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?pid=${pid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(400);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(await response.json()).toEqual({
            ok: false,
            error: "Invalid or missing auth",
        });
    });

});

// STANDARD RID/PID CALLBACK FLOW
describe("Thanks/Index - standard rid/pid callback flow", () => {

    // MOCK VALUES USED FOR PID/RID CALLBACK TESTING
    const pid = "12345678901234567890";
    const projectId = "project-1";
    const supplierId = "supplier-1";
    const supplierCode = "SUP001";
    const externalId = "RESP001";
    const respondentId = "respondent-1";
    const supplierEntryId = "supplier-entry-1";

    // RESET ALL MOCKS BEFORE EACH TEST
    beforeEach(() => {
        vi.clearAllMocks();

        // FIND SURVEYREDIRECT USING PID/RID
        mockPrisma.surveyRedirect.findUnique.mockResolvedValue({
            id: pid,
            projectId,
            supplierId,
            respondentId,
            externalId,
            destination: null,
            result: null,
            recid: null,
        });

        // UPDATE SURVEYREDIRECT WITH THE RESULT
        mockPrisma.surveyRedirect.update.mockResolvedValue({
            id: pid,
            result: "COMPLETE",
        });

        // FIND SUPPLIER
        mockPrisma.supplier.findUnique.mockResolvedValue({
            id: supplierId,
            code: supplierCode,
            name: "Supplier One",
            completeUrl:
                "https://supplier.example.com/complete?id=[identifier]",
            terminateUrl: null,
            overQuotaUrl: null,
            qualityTermUrl: null,
            surveyCloseUrl: null,
        });

        // FIND SUPPLIERENTRY USING PROJECT + SUPPLIER + EXTERNAL ID
        mockPrisma.supplierEntry.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: supplierEntryId,
                supplierCode,
                finalOutcome: null,
        });

        // UPDATE SUPPLIERENTRY WITH THE FINAL OUTCOME
        mockPrisma.supplierEntry.update.mockResolvedValue({
            id: supplierEntryId,
            finalOutcome: "COMPLETE",
        });

        // CREATE FINAL CALLBACK EVENT
        mockPrisma.supplierRedirectEvent.create.mockResolvedValue({
            id: "event-1",
        });

    });

    // CALLBACK WITH RID/PID SHOULD FIND SURVEYREDIRECT BY ID.
    it("callback with rid/pid should find SurveyRedirect by id", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&rid=${pid}`
        );

        await GET(request);

        expect(
            mockPrisma.surveyRedirect.findUnique
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: pid,
                },
            })
        );
    });

    // SHOULD UPDATE SURVEYREDIRECT RESULT TO COMPLETE WHERE ID = PID
    it("should update SurveyRedirect result to COMPLETE", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&rid=${pid}`
        );

        await GET(request);

        expect(
            mockPrisma.surveyRedirect.update
        ).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "COMPLETE",
            },
        });
    });

    // SUPPLIERENTRY SHOULD BE FINALIZED USING PROJECTID, SUPPLIERID/SUPPLIERCODE, EXTERNALID
    it("should find SupplierEntry using projectId supplierCode and externalId", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&rid=${pid}`
        );

        await GET(request);

        expect(
            mockPrisma.supplierEntry.findUnique
        ).toHaveBeenCalledWith({
            where: {
                projectId_supplierCode_externalId: {
                    projectId,
                    supplierCode,
                    externalId,
                },
            },
            select: {
                id: true,
                supplierCode: true,
                finalOutcome: true,
            },
        });
    });

    // SHOULD UPDATE SUPPLIERENTRY FINAL OUTCOME, FINAL SOURCE, AND FINAL OUTCOME TIME
    it("should finalize SupplierEntry with COMPLETE outcome", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&rid=${pid}`
        );

        await GET(request);

        expect(
            mockPrisma.supplierEntry.update
        ).toHaveBeenCalledWith({
            where: {
                id: supplierEntryId,
            },
            data: {
                currentStage: "FINALIZED",
                finalOutcome: "COMPLETE",
                finalOutcomeAt: expect.any(Date),
                finalSource: "SURVEY_CALLBACK",
            },
        });
    });

    // SHOULD CREATE SUPPLIER REDIRECT CALLBACK EVENT
    it("should create supplier redirect callback event", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&rid=${pid}`
        );

        await GET(request);

        expect(
            mockPrisma.supplierRedirectEvent.create
        ).toHaveBeenCalledWith({
            data: {
                projectId,
                supplierId,
                respondentId,
                pid,
                outcome: "COMPLETE",
            },
        });
    });

    // SHOULD REDIRECT RESPONDENT TO THE SUPPLIER FINAL REDIRECT URL
    it("should redirect respondent to supplier COMPLETE URL", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&rid=${pid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(302);

        const location = response.headers.get("location");

        expect(location).toContain("status=COMPLETE");

        expect(location).toContain(
            encodeURIComponent(
                `https://supplier.example.com/complete?id=${externalId}`
            )
        );
    });

});

// RECONTACT SINGLE-PARAMETER CALLBACK FLOW
describe("Thanks/Index - recontact single-parameter callback flow", () => {

    // MOCK VALUES USED FOR RECONTACT SINGLE-PARAMETER CALLBACK TESTING
    const projectCode = "PROJECT001";
    const projectId = "project-1";
    const recid = "REC001";
    const pid = "12345678901234567890";
    const supplierId = "supplier-1";
    const supplierCode = "SUP001";
    const externalId = "RESP001";
    const respondentId = "respondent-1";
    const supplierEntryId = "supplier-entry-1";

    const pendingRedirect = {
        id: pid,
        projectId,
        supplierId,
        respondentId,
        externalId,
        destination: null,
        result: null,
        recid,
    };

    // RESET ALL MOCKS BEFORE EACH TEST
    beforeEach(() => {
        vi.clearAllMocks();

        // RESOLVE PROJECT CODE TO PROJECT ID
        mockPrisma.project.findFirst.mockResolvedValue({
            id: projectId,
            code: projectCode,
            projectType: "Recontact",
        });

        // FIND SUPPLIER
        mockPrisma.supplier.findUnique.mockResolvedValue({
            id: supplierId,
            code: supplierCode,
            name: "Supplier One",
            completeUrl: null,
            terminateUrl: null,
            overQuotaUrl: null,
            qualityTermUrl: null,
            surveyCloseUrl: null,
        });

        // FIRST LOOKUP RETURNS NO SUPPLIERENTRY
        // SECOND LOOKUP RETURNS THE MATCHING SUPPLIERENTRY
        mockPrisma.supplierEntry.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: supplierEntryId,
                supplierCode,
                finalOutcome: null,
        });

        // MOCK SUPPLIERENTRY UPDATE WITH COMPLETE OUTCOME
        mockPrisma.supplierEntry.update.mockResolvedValue({
            id: supplierEntryId,
            finalOutcome: "COMPLETE",
        });

        // MOCK SURVEYREDIRECT UPDATE WITH COMPLETE RESULT
        mockPrisma.surveyRedirect.update.mockResolvedValue({
            ...pendingRedirect,
            result: "COMPLETE",
        });

        // MOCK SUPPLIER REDIRECT EVENT CREATION
        mockPrisma.supplierRedirectEvent.create.mockResolvedValue({
            id: "event-1",
        });

    });

    // SHOULD RESOLVE THE CORRECT PENDING SURVEYREDIRECT USING PROJECTID + RECID
    it("projectId + recid should resolve the correct pending SurveyRedirect", async () => {
        mockPrisma.surveyRedirect.findMany.mockResolvedValue([
            pendingRedirect,
        ]);

        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&projectId=${projectCode}&recid=${recid}`
        );

        await GET(request);

        expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
            where: {
                OR: [
                    { id: projectCode },
                    { code: projectCode },
                ],
            },
            select: {
                id: true,
                code: true,
                projectType: true,
            },
        });

        expect(
            mockPrisma.surveyRedirect.findMany
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    projectId,
                    recid,
                    result: null,
                },
                take: 2,
            })
        );
    });

    // SHOULD MATCH SURVEYREDIRECT WITHIN THE CORRECT PROJECT
    it("matching should be scoped by projectId and not recid only", async () => {
        mockPrisma.surveyRedirect.findMany.mockResolvedValue([
            pendingRedirect,
        ]);

        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&projectId=${projectCode}&recid=${recid}`
        );

        await GET(request);

        expect(
            mockPrisma.surveyRedirect.findMany
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    projectId,
                    recid,
                    result: null,
                }),
            })
        );
    });

    // SHOULD FINALIZE WHEN EXACTLY ONE PENDING SURVEYREDIRECT IS FOUND
    it("exactly one pending SurveyRedirect should be finalized", async () => {
        mockPrisma.surveyRedirect.findMany.mockResolvedValue([
            pendingRedirect,
        ]);

        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&projectId=${projectCode}&recid=${recid}`
        );

        await GET(request);

        expect(
            mockPrisma.surveyRedirect.update
        ).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "COMPLETE",
            },
        });

        expect(
            mockPrisma.supplierEntry.update
        ).toHaveBeenCalledWith({
            where: {
                id: supplierEntryId,
            },
            data: {
                currentStage: "FINALIZED",
                finalOutcome: "COMPLETE",
                finalOutcomeAt: expect.any(Date),
                finalSource: "SURVEY_CALLBACK",
            },
        });
    });

    // SHOULD NOT FINALIZE WHEN NO MATCHING SURVEYREDIRECT IS FOUND
    it("no matching pending SurveyRedirect should not finalize", async () => {
        mockPrisma.surveyRedirect.findMany.mockResolvedValue([]);

        // ROUTE CHECKS FOR AN ALREADY FINALIZED MATCH AFTER NO PENDING MATCH
        mockPrisma.surveyRedirect.findFirst.mockResolvedValue(null);

        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&projectId=${projectCode}&recid=${recid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(400);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();
    });

    // SHOULD NOT GUESS OR FINALIZE WHEN MULTIPLE PENDING SURVEYREDIRECTS ARE FOUND
    it("multiple matching pending SurveyRedirect rows should not guess or finalize", async () => {
        mockPrisma.surveyRedirect.findMany.mockResolvedValue([
            {
                ...pendingRedirect,
                id: "12345678901234567890",
            },
            {
                ...pendingRedirect,
                id: "09876543210987654321",
            },
        ]);

        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&projectId=${projectCode}&recid=${recid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(409);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();

        const body = await response.json();

        expect(body.error).toBe(
            "Ambiguous recid callback. Multiple pending redirects matched."
        );
    });

});

// DUAL-PARAMETER CALLBACK FLOW SHOULD REMAIN UNCHANGED
describe("Thanks/Index - dual-parameter callback flow", () => {

    // MOCK VALUES USED FOR DUAL-PARAMETER CALLBACK FLOW TESTING
    const pid = "12345678901234567890";
    const projectId = "project-1";
    const projectCode = "PROJECT001";
    const recid = "REC001";
    const supplierId = "supplier-1";
    const supplierCode = "SUP001";
    const externalId = "RESP001";
    const respondentId = "respondent-1";
    const supplierEntryId = "supplier-entry-1";

    // RESET ALL MOCKS BEFORE EACH TEST
    beforeEach(() => {
        vi.clearAllMocks();

        // FIND SURVEYREDIRECT DIRECTLY USING RID/PID
        mockPrisma.surveyRedirect.findUnique.mockResolvedValue({
            id: pid,
            projectId,
            supplierId,
            respondentId,
            externalId,
            destination: null,
            result: null,
            recid,
        });

        // MOCK SURVEYREDIRECT UPDATE WITH COMPLETE RESULT
        mockPrisma.surveyRedirect.update.mockResolvedValue({
            id: pid,
            result: "COMPLETE",
        });

        // FIND THE SUPPLIER FOR THE SURVEYREDIRECT
        mockPrisma.supplier.findUnique.mockResolvedValue({
            id: supplierId,
            code: supplierCode,
            name: "Supplier One",
            completeUrl: null,
            terminateUrl: null,
            overQuotaUrl: null,
            qualityTermUrl: null,
            surveyCloseUrl: null,
        });

        // FIRST LOOKUP RETURNS NO SUPPLIERENTRY
        // SECOND LOOKUP RETURNS THE MATCHING SUPPLIERENTRY
        mockPrisma.supplierEntry.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: supplierEntryId,
                supplierCode,
                finalOutcome: null,
            });

        // MOCK SUPPLIERENTRY UPDATE WITH COMPLETE OUTCOME
        mockPrisma.supplierEntry.update.mockResolvedValue({
            id: supplierEntryId,
            finalOutcome: "COMPLETE",
        });

        // MOCK SUPPLIER REDIRECT EVENT CREATION
        mockPrisma.supplierRedirectEvent.create.mockResolvedValue({
            id: "event-1",
        });

    });

    // IF RID/PID IS PROVIDED, RID/PID SHOULD REMAIN THE PRIMARY LOOKUP
    it("rid/pid should remain the primary lookup when recid is also provided", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&pid=${pid}&projectId=${projectCode}&recid=${recid}`
        );

        await GET(request);

        expect(
            mockPrisma.surveyRedirect.findUnique
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: pid,
                },
            })
        );

        expect(
            mockPrisma.surveyRedirect.findMany
        ).not.toHaveBeenCalled();
    });

    // RECONTACT RECID SHOULD NOT BREAK EXISTING RID/PID CALLBACK BEHAVIOR.
    it("recontact recid should not break existing rid/pid callback behavior", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&rid=${pid}&projectId=${projectCode}&recid=${recid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(302);

        expect(
            mockPrisma.surveyRedirect.update
        ).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "COMPLETE",
            },
        });

        expect(
            response.headers.get("location")
        ).toContain("status=COMPLETE");
    });

    // DUAL FLOW SHOULD FINALIZE BY OE GENERATED PID/RID AS BEFORE
    it("dual flow should finalize using OE generated pid/rid", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&pid=${pid}&projectId=${projectCode}&recid=${recid}`
        );

        await GET(request);

        expect(
            mockPrisma.surveyRedirect.update
        ).toHaveBeenCalledWith({
            where: {
                id: pid,
            },
            data: {
                result: "COMPLETE",
            },
        });

        expect(
            mockPrisma.supplierEntry.update
        ).toHaveBeenCalledWith({
            where: {
                id: supplierEntryId,
            },
            data: {
                currentStage: "FINALIZED",
                finalOutcome: "COMPLETE",
                finalOutcomeAt: expect.any(Date),
                finalSource: "SURVEY_CALLBACK",
            },
        });

        expect(
            mockPrisma.supplierRedirectEvent.create
        ).toHaveBeenCalledWith({
            data: {
                projectId,
                supplierId,
                respondentId,
                pid,
                outcome: "COMPLETE",
            },
        });
    });

});

// PLACEHOLDER/INVALID VALUES
describe("Thanks/Index - placeholder and invalid values", () => {

    // MOCK VALUES USED FOR PLACEHOLDER/INVALID VALUES TESTING
    const projectCode = "PROJECT001";
    const projectId = "project-1";

    // RESET ALL MOCKS BEFORE EACH TEST
    beforeEach(() => {
        vi.clearAllMocks();

        mockPrisma.project.findFirst.mockResolvedValue({
            id: projectId,
            code: projectCode,
            projectType: "Recontact",
        });

        // NO VALID REDIRECT FOUND FOR INVALID RECID
        mockPrisma.surveyRedirect.findMany.mockResolvedValue([]);

        // NO PREVIOUSLY FINALIZED REDIRECT FOUND
        mockPrisma.surveyRedirect.findFirst.mockResolvedValue(null);
    });

    // RECID PLACEHOLDER SHOULD NOT FINALIZE
    it("recid=<APID> should not finalize", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&projectId=${projectCode}&recid=%3CAPID%3E`
        );

        const response = await GET(request);

        expect(response.status).toBe(400);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();
    });

    // ENCODED RECID PLACEHOLDER SHOULD NOT FINALIZE
    it("encoded recid=%3CAPID%3E should not finalize", async () => {
        const encodedApid = encodeURIComponent("<APID>");

        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&projectId=${projectCode}&recid=${encodedApid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(400);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();
    });

    // RECID-ONLY CALLBACK WITHOUT PROJECTID SHOULD NOT FINALIZE
    it("recid-only callback without projectId should not finalize", async () => {
        const request = new Request(
            "http://localhost/Thanks/Index?auth=10&recid=REC001"
        );

        const response = await GET(request);

        expect(response.status).toBe(400);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();

        expect(await response.json()).toEqual({
            ok: false,
            error: "projectId is required for recid callback.",
        });
    });

    // PLACEHOLDER RID/PID LIKE [IDENTIFIER] SHOULD NOT FINALIZE
    it("placeholder rid=[identifier] should not finalize", async () => {
        const request = new Request(
            "http://localhost/Thanks/Index?auth=10&rid=%5Bidentifier%5D"
        );

        const response = await GET(request);

        expect(response.status).toBe(400);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();
    });

    // EMPTY CALLBACK VALUES SHOULD NOT FINALIZE
    it("empty callback values should not finalize", async () => {
        const request = new Request(
            "http://localhost/Thanks/Index?auth=10&pid=&rid=&projectId=&recid="
        );

        const response = await GET(request);

        expect(response.status).toBe(400);

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();

        expect(await response.json()).toEqual({
            ok: false,
            error: "Missing pid/rid, MemberCode, or recid",
        });
    });

});

// IDEMPOTENCY / NO OVERWRITE BEHAVIOR
describe("Thanks/Index - idempotency and no overwrite behavior", () => {

    // MOCK VALUES USED FOR IDEMPOTENCY / NO OVERWRITE BEHAVIOR TESTING
    const pid = "12345678901234567890";
    const projectId = "project-1";
    const supplierId = "supplier-1";
    const supplierCode = "SUP001";
    const externalId = "RESP001";
    const respondentId = "respondent-1";
    const supplierEntryId = "supplier-entry-1";

    // RESET ALL MOCKS BEFORE EACH TEST
    beforeEach(() => {
        vi.clearAllMocks();

        // FIND THE EXISTING SURVEYREDIRECT
        mockPrisma.surveyRedirect.findUnique.mockResolvedValue({
            id: pid,
            projectId,
            supplierId,
            respondentId,
            externalId,
            destination: null,
            result: "COMPLETE",
            recid: null,
        });

        // FIND THE SUPPLIER FOR THE SURVEYREDIRECT
        mockPrisma.supplier.findUnique.mockResolvedValue({
            id: supplierId,
            code: supplierCode,
            name: "Supplier One",
            completeUrl: null,
            terminateUrl: null,
            overQuotaUrl: null,
            qualityTermUrl: null,
            surveyCloseUrl: null,
        });

        // FIRST LOOKUP USING supplierId DOES NOT MATCH
        // SECOND LOOKUP USING supplierCode FINDS EXISTING FINAL ENTRY
        mockPrisma.supplierEntry.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: supplierEntryId,
                supplierCode,
                finalOutcome: "COMPLETE",
            });

        // MOCK SUPPLIER REDIRECT EVENT CREATION
        mockPrisma.supplierRedirectEvent.create.mockResolvedValue({
            id: "event-1",
        });

    });

    // SHOULD NOT OVERWRITE AN EXISTING FINAL OUTCOME
    it("should not overwrite SupplierEntry when finalOutcome already exists", async () => {
    mockPrisma.supplierEntry.findUnique.mockReset();

    mockPrisma.supplierEntry.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
            id: supplierEntryId,
            supplierCode,
            finalOutcome: "COMPLETE",
        });

    const request = new Request(
        `http://localhost/Thanks/Index?auth=20&pid=${pid}`
    );

    await GET(request);

    expect(
        mockPrisma.supplierEntry.update
    ).not.toHaveBeenCalled();
    });

    // SHOULD NOT OVERWRITE AN EXISTING FINAL OUTCOME
    it("should preserve the existing SupplierEntry finalOutcome", async () => {
        mockPrisma.supplierEntry.findUnique.mockReset();

        mockPrisma.supplierEntry.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: supplierEntryId,
                supplierCode,
                finalOutcome: "COMPLETE",
            });

        const request = new Request(
            `http://localhost/Thanks/Index?auth=20&pid=${pid}`
        );

        await GET(request);

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.supplierEntry.findUnique
        ).toHaveBeenCalledWith({
            where: {
                projectId_supplierCode_externalId: {
                    projectId,
                    supplierCode,
                    externalId,
                },
            },
            select: {
                id: true,
                supplierCode: true,
                finalOutcome: true,
            },
        });
    });

    // REPEATED CALLBACK SHOULD NOT UPDATE ALREADY FINALIZED RECORDS
    it("repeated COMPLETE callback should not update SupplierEntry again", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&pid=${pid}`
        );

        await GET(request);

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();

        expect(
            mockPrisma.surveyRedirect.update
        ).not.toHaveBeenCalled();
    });

    // REPEATED CALLBACK SHOULD CREATE THE REDIRECT EVENT AS PER CURRENT ROUTE BEHAVIOR
    it("current route should still create supplier redirect event for repeated callback", async () => {
        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&pid=${pid}`
        );

        await GET(request);

        expect(
            mockPrisma.supplierRedirectEvent.create
        ).toHaveBeenCalledWith({
            data: {
                projectId,
                supplierId,
                respondentId,
                pid,
                outcome: "COMPLETE",
            },
        });
    });

});

// SUPPLIER FINAL REDIRECT
describe("Thanks/Index - supplier final redirect", () => {

    // MOCK VALUES USED FOR SUPPLIER FINAL REDIRECT TESTING
    const pid = "12345678901234567890";
    const projectId = "project-1";
    const supplierId = "supplier-1";
    const supplierCode = "SUP001";
    const externalId = "RESP001";
    const respondentId = "respondent-1";

    // SET UP MOCK DATA FOR SUPPLIER REDIRECT TESTING
    function setupSupplier(
        urls: {
            completeUrl?: string | null;
            terminateUrl?: string | null;
            overQuotaUrl?: string | null;
            qualityTermUrl?: string | null;
        } = {}
    ) {
        // FIND SURVEYREDIRECT USING PID
        mockPrisma.surveyRedirect.findUnique.mockResolvedValue({
            id: pid,
            projectId,
            supplierId,
            respondentId,
            externalId,
            destination: null,
            result: null,
            recid: null,
        });

        // MOCK SURVEYREDIRECT UPDATE
        mockPrisma.surveyRedirect.update.mockResolvedValue({});

        // SET UP SUPPLIER WITH THE REDIRECT URL FOR THE TEST
        mockPrisma.supplier.findUnique.mockResolvedValue({
            id: supplierId,
            code: supplierCode,
            name: "Supplier One",
            completeUrl: urls.completeUrl ?? null,
            terminateUrl: urls.terminateUrl ?? null,
            overQuotaUrl: urls.overQuotaUrl ?? null,
            qualityTermUrl: urls.qualityTermUrl ?? null,
            surveyCloseUrl: null,
        });

        // AVOID SUPPLIERENTRY FINALIZATION INTERFERING
        // WITH THESE REDIRECT-ONLY TESTS
        mockPrisma.supplierEntry.findUnique.mockResolvedValue(null);
        mockPrisma.supplierEntry.findMany.mockResolvedValue([]);

        // MOCK SUPPLIER REDIRECT EVENT CREATION
        mockPrisma.supplierRedirectEvent.create.mockResolvedValue({
            id: "event-1",
        });
    }

    // RESET MOCK IMPLEMENTATIONS FROM PREVIOUS TESTS
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.surveyRedirect.findUnique.mockReset();
        mockPrisma.surveyRedirect.update.mockReset();
        mockPrisma.supplier.findUnique.mockReset();
        mockPrisma.supplierEntry.findUnique.mockReset();
        mockPrisma.supplierEntry.findMany.mockReset();
        mockPrisma.supplierRedirectEvent.create.mockReset();
    });

    // COMPLETE SHOULD USE THE SUPPLIER COMPLETE REDIRECT URL
    it("COMPLETE should use supplier complete redirect URL", async () => {
        setupSupplier({
            completeUrl:
                "https://supplier.example.com/complete?id=[identifier]",
        });

        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&pid=${pid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(302);

        const location = response.headers.get("location");
        expect(location).not.toBeNull();

        const thanksUrl = new URL(location!);

        expect(thanksUrl.searchParams.get("status")).toBe("COMPLETE");

        expect(thanksUrl.searchParams.get("next")).toBe(
            `https://supplier.example.com/complete?id=${externalId}`
        );
    });

    // TERMINATE SHOULD USE THE SUPPLIER TERMINATE REDIRECT URL
    it("TERMINATE should use supplier terminate redirect URL", async () => {
        setupSupplier({
            terminateUrl:
                "https://supplier.example.com/terminate?id=[identifier]",
        });

        const request = new Request(
            `http://localhost/Thanks/Index?auth=20&pid=${pid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(302);

        const location = response.headers.get("location");
        expect(location).not.toBeNull();

        const thanksUrl = new URL(location!);

        expect(thanksUrl.searchParams.get("status")).toBe(
            "TERMINATE"
        );

        expect(thanksUrl.searchParams.get("next")).toBe(
            `https://supplier.example.com/terminate?id=${externalId}`
        );
    });

    // OVER_QUOTA SHOULD USE THE SUPPLIER OVER-QUOTA REDIRECT URL
    it("OVER_QUOTA should use supplier over-quota redirect URL", async () => {
        setupSupplier({
            overQuotaUrl:
                "https://supplier.example.com/overquota?id=[identifier]",
        });

        const request = new Request(
            `http://localhost/Thanks/Index?auth=40&pid=${pid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(302);

        const location = response.headers.get("location");
        expect(location).not.toBeNull();

        const thanksUrl = new URL(location!);

        expect(thanksUrl.searchParams.get("status")).toBe(
            "OVERQUOTA"
        );

        expect(thanksUrl.searchParams.get("next")).toBe(
            `https://supplier.example.com/overquota?id=${externalId}`
        );
    });

    // QUALITY_TERM SHOULD USE THE SUPPLIER QUALITY TERMINATE REDIRECT URL
    it("QUALITY_TERM should use supplier quality terminate redirect URL", async () => {
        setupSupplier({
            qualityTermUrl:
                "https://supplier.example.com/quality?id=[identifier]",
        });

        const request = new Request(
            `http://localhost/Thanks/Index?auth=30&pid=${pid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(302);

        const location = response.headers.get("location");
        expect(location).not.toBeNull();

        const thanksUrl = new URL(location!);

        expect(thanksUrl.searchParams.get("status")).toBe(
            "QUALITYTERM"
        );

        expect(thanksUrl.searchParams.get("next")).toBe(
            `https://supplier.example.com/quality?id=${externalId}`
        );
    });

    // MISSING SUPPLIER REDIRECT URL SHOULD FOLLOW THE CURRENT ROUTE FALLBACK
    it("missing supplier redirect URL should follow current route fallback behavior", async () => {
        setupSupplier({
            completeUrl: null,
        });

        const request = new Request(
            `http://localhost/Thanks/Index?auth=10&pid=${pid}`
        );

        const response = await GET(request);

        expect(response.status).toBe(302);

        const location = response.headers.get("location");
        expect(location).not.toBeNull();

        const thanksUrl = new URL(location!);

        expect(thanksUrl.pathname).toBe("/Thanks");

        expect(thanksUrl.searchParams.get("status")).toBe(
            "COMPLETE"
        );

        expect(thanksUrl.searchParams.get("pid")).toBe(pid);

        expect(thanksUrl.searchParams.has("next")).toBe(false);
    });

});
