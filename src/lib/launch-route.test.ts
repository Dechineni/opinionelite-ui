import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/projects/[projectId]/launch/route";

const mockPrisma = {
    project: {
        findFirst: vi.fn(),
    },
    prescreenQuestion: {
        count: vi.fn(),
    },
};

vi.mock("@/lib/prisma", () => ({
    getPrisma: () => mockPrisma,
}));

describe("launch route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("preserves supplierId id and recid during prescreen redirect", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
            code: "PRJ1",
            preScreen: true,
            sentryEnabled: false,
            apiSurveySelection: null,
            client: null,
        });

        mockPrisma.prescreenQuestion.count.mockResolvedValue(1);

        const req = new Request(
            "https://test.com/api/projects/PRJ1/launch?supplierId=S1&id=EXT1&recid=REC1"
        );

        const res = await GET(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
            }),
        });

        const location = res.headers.get("location") ?? "";
        expect(location).toContain("/Prescreen");
        expect(location).toContain("supplierId=S1");
        expect(location).toContain("id=EXT1");
        expect(location).toContain("recid=REC1");
        expect(location).toContain("projectId=PRJ1");
    });

    it("preserves supplierId id and recid during survey-live redirect", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
            code: "PRJ1",
            preScreen: false,
            sentryEnabled: false,
            apiSurveySelection: null,
            client: null,
        });

        mockPrisma.prescreenQuestion.count.mockResolvedValue(0);

        const req = new Request(
            "https://test.com/api/projects/PRJ1/launch?supplierId=S1&id=EXT1&recid=REC1"
        );

        const res = await GET(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
            }),
        });

        const location = res.headers.get("location") ?? "";

        expect(location).toContain("/survey-live");
        expect(location).toContain("supplierId=S1");
        expect(location).toContain("id=EXT1");
        expect(location).toContain("recid=REC1");
    });
});
