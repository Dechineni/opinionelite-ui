import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET as sentryStartGet } from "@/app/api/projects/[projectId]/sentry-start/route";
import { GET as sentryCallbackGet } from "@/app/api/projects/[projectId]/sentry-callback/route";

const mockPrisma = {
    project: {
        findFirst: vi.fn(),
    },

    sentryRespondentResult: {
        upsert: vi.fn(),
    },

    supplierEntry: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
};

vi.mock("@/lib/prisma", () => ({
    getPrisma: () => mockPrisma,
}));

describe("sentry start route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("preserves supplierId externalId and recid", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
            code: "PRJ1",
            sentryEnabled: true,
            sentryProjectId: "SP1",
            sentryLiveUrl: "https://sentry.example.com",
            sentryTestUrl: null,
            sentryProviderId: "P1",
            sentryIdField: "aid",
        });

        const req = new Request(
            "https://test.com/api/projects/PRJ1/sentry-start?supplierId=S1&id=EXT1&recid=REC1"
        );

        const res = await sentryStartGet(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
            }),
        });

        const location = res.headers.get("location") ?? "";

        expect(location).toContain("supplierId=S1");
        expect(location).toContain("aid=EXT1");
        expect(location).toContain("recid=REC1");
    });

    //PASS callback test
    it("preserves context on sentry pass", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
            code: "PRJ1",
        });

        mockPrisma.sentryRespondentResult.upsert.mockResolvedValue({});

        const req = new Request(
            "https://test.com/api/projects/PRJ1/sentry-callback?sentry_status=1&supplierId=S1&aid=EXT1&recid=REC1"
        );

        const res = await sentryCallbackGet(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
            }),
        });

        const location = res.headers.get("location") ?? "";

        expect(location).toContain("/launch");
        expect(location).toContain("supplierId=S1");
        expect(location).toContain("id=EXT1");
        expect(location).toContain("recid=REC1");

        expect(location).toContain("fromPrescreen=1");
        expect(location).toContain("fromSentry=1");
        expect(location).toContain("sentryDone=1");
    });

    //FAIL callback test
    it("preserves context on sentry failure", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
            code: "PRJ1",
        });

        mockPrisma.sentryRespondentResult.upsert.mockResolvedValue({});

        mockPrisma.supplierEntry.findUnique.mockResolvedValue(null);

        const req = new Request(
            "https://test.com/api/projects/PRJ1/sentry-callback?sentry_status=2&supplierId=S1&aid=EXT1&recid=REC1"
        );

        const res = await sentryCallbackGet(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
            }),
        });

        const location = res.headers.get("location") ?? "";

        expect(location).toContain("/Thanks");
        expect(location).toContain("status=TERMINATE");

        expect(location).toContain("supplierId=S1");
        expect(location).toContain("id=EXT1");
        expect(location).toContain("recid=REC1");
    });

    it("skips SupplierEntry finalization for placeholder externalId on sentry failure", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
            code: "PRJ1",
        });

        mockPrisma.sentryRespondentResult.upsert.mockResolvedValue({});

        const req = new Request(
            "https://test.com/api/projects/PRJ1/sentry-callback?sentry_status=2&supplierId=S1&aid=[identifier]&recid=REC1"
        );

        const res = await sentryCallbackGet(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
            }),
        });

        const location = res.headers.get("location") ?? "";

        expect(location).toContain("/Thanks");
        expect(location).toContain("status=TERMINATE");

        expect(
            mockPrisma.supplierEntry.update
        ).not.toHaveBeenCalled();
    });
});
