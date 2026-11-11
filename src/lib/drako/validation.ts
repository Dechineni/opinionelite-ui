import { isDrakoSupplier } from "@/lib/drako/server";

type DrakoValidationFailure = {
    valid: false;
    status: number;
    reason: string;
};

type DrakoValidationSuccess = {
    valid: true;
    drako: true;
    project: {
        id: string;
        code: string | null;
        status: string;
        projectType: string | null;
        startDate: Date | null;
        endDate: Date | null;
    };
    supplier: {
        id: string;
        code: string;
    };
};

export type DrakoValidationResult =
    | DrakoValidationFailure
    | DrakoValidationSuccess;

export async function validateDrakoAccess(
    prisma: any,
    projectId: string,
    supplierCode: string
): Promise<DrakoValidationResult> {
    const project = await prisma.project.findFirst({
        where: {
            OR: [
                { id: projectId },
                { code: projectId },
            ],
        },
        select: {
            id: true,
            code: true,
            status: true,
            projectType: true,
            startDate: true,
            endDate: true,
        },
    });

    if (!project) {
        return {
            valid: false,
            status: 404,
            reason: "Project not found",
        };
    }

    if (
        project.projectType?.trim().toLowerCase() ===
        "recontact"
    ) {
        return {
            valid: false,
            status: 403,
            reason: "Recontact not supported",
        };
    }

    if (project.status !== "ACTIVE") {
        return {
            valid: false,
            status: 403,
            reason: "Project is not active",
        };
    }

    const now = new Date();

    if (
        project.startDate &&
        now < project.startDate
    ) {
        return {
            valid: false,
            status: 403,
            reason: "Project not started",
        };
    }

    if (
        project.endDate &&
        now > project.endDate
    ) {
        return {
            valid: false,
            status: 403,
            reason: "Project closed",
        };
    }

    const supplier = await prisma.supplier.findUnique({
        where: {
            code: supplierCode,
        },
        select: {
            id: true,
            code: true,
        },
    });

    if (!supplier) {
        return {
            valid: false,
            status: 404,
            reason: "Supplier not found",
        };
    }

    if (!isDrakoSupplier(supplier.code)) {
        return {
            valid: false,
            status: 403,
            reason: "Supplier is not DRAKO",
        };
    }

    const mapping =
        await prisma.projectSupplierMap.findUnique({
            where: {
                projectId_supplierId: {
                    projectId: project.id,
                    supplierId: supplier.id,
                },
            },
            select: {
                allowTraffic: true,
            },
        });

    if (!mapping) {
        return {
            valid: false,
            status: 403,
            reason: "Mapping missing",
        };
    }

    if (!mapping.allowTraffic) {
        return {
            valid: false,
            status: 403,
            reason: "Traffic disabled",
        };
    }
    return {
        valid: true,
        drako: true,
        project,
        supplier,
    };

}