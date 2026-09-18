import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/projects/[projectId]/prescreen/[identifier]/answers/route";

const mockPrisma = {
    project: {
        findFirst: vi.fn(),
    },

    respondent: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },

    prescreenQuestion: {
        findMany: vi.fn(),
    },

    prescreenAnswer: {
        deleteMany: vi.fn(),
        create: vi.fn(),
    },

    supplierEntry: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
    },
};

vi.mock("@/lib/prisma", () => ({
    getPrisma: () => mockPrisma,
}));

describe("prescreen route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.supplierEntry.findMany.mockResolvedValue([]);
        mockPrisma.supplierEntry.findUnique.mockResolvedValue(null);
        mockPrisma.supplierEntry.update.mockResolvedValue({});
    });

    it("fails when required text answer is empty", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "TEXT",
                textMinLength: null,
                textMaxLength: null,
                options: [],
            },
        ]);

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: "",
                        },
                    ],
                }),
            }
        );

        const res = await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        const json = await res.json();

        expect(json.pass).toBe(false);
    });

    it("stores open ended answer text", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "TEXT",
                textMinLength: null,
                textMaxLength: null,
                options: [],
            },
        ]);

        mockPrisma.prescreenAnswer.deleteMany.mockResolvedValue({});

        mockPrisma.prescreenAnswer.create.mockResolvedValue({});

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: "I like surveys",
                        },
                    ],
                }),
            }
        );

        await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        expect(
            mockPrisma.prescreenAnswer.create
        ).toHaveBeenCalled();

        expect(
            mockPrisma.prescreenAnswer.create.mock.calls[0][0]
                .data.answerText
        ).toBe("I like surveys");
    });

    it("stores single select answer value", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "RADIO",
                options: [
                    {
                        value: "YES",
                        label: "YES",
                        enabled: true,
                        validate: true,
                    },
                ],
            },
        ]);

        mockPrisma.prescreenAnswer.deleteMany.mockResolvedValue({});
        mockPrisma.prescreenAnswer.create.mockResolvedValue({});

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: "YES",
                        },
                    ],
                }),
            }
        );

        await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        expect(
            mockPrisma.prescreenAnswer.create.mock.calls[0][0]
                .data.answerValue
        ).toBe("YES");
    });

    it("stores multiple select values", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "CHECKBOX",
                options: [],
            },
        ]);

        mockPrisma.prescreenAnswer.deleteMany.mockResolvedValue({});
        mockPrisma.prescreenAnswer.create.mockResolvedValue({});

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: ["A", "B"],
                        },
                    ],
                }),
            }
        );

        await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        expect(
            mockPrisma.prescreenAnswer.create.mock.calls[0][0]
                .data.selectedValues
        ).toEqual(["A", "B"]);
    });


    it("preserves recid when creating respondent", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue(null);

        mockPrisma.respondent.create.mockResolvedValue({
            id: "RESP1",
            recid: "REC001",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "TEXT",
                textMinLength: null,
                textMaxLength: null,
                options: [],
            },
        ]);

        mockPrisma.prescreenAnswer.deleteMany.mockResolvedValue({});
        mockPrisma.prescreenAnswer.create.mockResolvedValue({});

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    recid: "REC001",
                    answers: [
                        {
                            questionId: "Q1",
                            value: "hello",
                        },
                    ],
                }),
            }
        );

        await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        expect(mockPrisma.respondent.create).toHaveBeenCalled();

        expect(
            mockPrisma.respondent.create.mock.calls[0][0].data.recid
        ).toBe("REC001");
    });

    //Radio Pass/Fail validation tests
    it("passes when radio value matches validate enabled option", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "RADIO",
                textMinLength: null,
                textMaxLength: null,
                options: [
                    {
                        value: "YES",
                        label: "YES",
                        enabled: true,
                        validate: true,
                    },
                ],
            },
        ]);

        mockPrisma.prescreenAnswer.deleteMany.mockResolvedValue({});
        mockPrisma.prescreenAnswer.create.mockResolvedValue({});

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: "YES",
                        },
                    ],
                }),
            }
        );

        const res = await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        const json = await res.json();

        expect(json.pass).toBe(true);
    });

    it("fails when radio value does not match validate enabled option", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "RADIO",
                textMinLength: null,
                textMaxLength: null,
                options: [
                    {
                        value: "YES",
                        label: "YES",
                        enabled: true,
                        validate: true,
                    },
                ],
            },
        ]);

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: "NO",
                        },
                    ],
                }),
            }
        );

        const res = await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        const json = await res.json();

        expect(json.pass).toBe(false);
    });

    //Checkbox pass/fail validation tests
    it("passes when checkbox includes at least one validate enabled option", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "CHECKBOX",
                textMinLength: null,
                textMaxLength: null,
                options: [
                    {
                        value: "A",
                        label: "A",
                        enabled: true,
                        validate: true,
                    },
                ],
            },
        ]);

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: ["A", "OTHER"],
                        },
                    ],
                }),
            }
        );

        const res = await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        const json = await res.json();

        expect(json.pass).toBe(true);
    });

    //Numeric question validation tests
    it("passes numeric text validation within configured range", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "TEXT",
                textMinLength: 18,
                textMaxLength: 65,
                options: [],
            },
        ]);

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: "30",
                        },
                    ],
                }),
            }
        );

        const res = await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        const json = await res.json();

        expect(json.pass).toBe(true);
    });

    //Numeric question validation tests
    it("fails numeric text validation when below minimum", async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
            id: "PRJ1",
        });

        mockPrisma.respondent.findFirst.mockResolvedValue({
            id: "RESP1",
        });

        mockPrisma.prescreenQuestion.findMany.mockResolvedValue([
            {
                id: "Q1",
                controlType: "TEXT",
                textMinLength: 18,
                textMaxLength: 65,
                options: [],
            },
        ]);

        const req = new Request(
            "https://test.com/api/projects/PRJ1/prescreen/EXT1/answers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: null,
                    answers: [
                        {
                            questionId: "Q1",
                            value: "15",
                        },
                    ],
                }),
            }
        );

        const res = await POST(req, {
            params: Promise.resolve({
                projectId: "PRJ1",
                identifier: "EXT1",
            }),
        });

        const json = await res.json();

        expect(json.pass).toBe(false);
    });
});
