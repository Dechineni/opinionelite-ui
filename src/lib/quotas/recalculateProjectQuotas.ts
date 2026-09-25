// src/lib/quotas/recalculateProjectQuotas.ts

import { getPrisma } from "@/lib/prisma";
import { isUsableExternalId } from "@/lib/utils/isUsableExternalId";

export async function recalculateProjectQuotas(projectId: string) {
    const prisma = getPrisma();

    const quotas = await prisma.projectQuota.findMany({
        where: { projectId },
    });

    for (const quota of quotas) {
        if (!quota.prescreenQuestionId) {
            continue; // Skip if there's no associated prescreen questionId
        }

        const option = await prisma.prescreenOption.findFirst({
            where: {
                questionId: quota.prescreenQuestionId,
                label: quota.quotaName,
            },
        });

        if (!option) {
            continue; // Skip if the option doesn't exist
        }

        const answers = await prisma.prescreenAnswer.findMany({
            where: {
                projectId,
                questionId: quota.prescreenQuestionId,
            },
            include: {
                respondent: true,
            },
        });

        const respondentIds = new Set<string>();
        for (const answer of answers) {
            if (!isUsableExternalId(answer.respondent?.externalId)) {
                continue; // Skip if the respondent's externalId is not usable
            }

            const radioMatch = answer.answerValue === option.value
                || answer.answerValue === option.label;

            const checkboxMatch = answer.selectedValues.includes(option.value)
                || answer.selectedValues.includes(option.label);


            if (radioMatch || checkboxMatch) {
                respondentIds.add(answer.respondentId);
            }
        }

        const quotaCount = respondentIds.size;

        const prescreenClicks = quotaCount; // Assuming prescreenClicks is the same as quotaCount for this example

        const respondents = await prisma.respondent.findMany({
            where: {
                id: { in: Array.from(respondentIds) },
            },
        });

        const externalIds = respondents
            .map((r) => r.externalId)
            .filter(Boolean) as string[]; // Filter out null or undefined externalIds

        const entries = await prisma.supplierEntry.findMany({
            where: {
                projectId,
                externalId: {
                    in: externalIds,
                },
            },
        });

        const matchedEntryIds = new Set<string>();

        for (const respondent of respondents) {
            if (!respondent.externalId) {
                continue;
            }

            let matches = entries.filter(
                (entry) => entry.externalId === respondent.externalId &&
                    entry.supplierCode === respondent.supplierId
            );

            if (matches.length === 0 && respondent.supplierId) {
                const supplier = await prisma.supplier.findUnique({
                    where: { id: respondent.supplierId },
                    select: { code: true },
                });

                if (supplier?.code) {
                    matches = entries.filter(
                        (entry) => entry.externalId === respondent.externalId &&
                            entry.supplierCode === supplier.code
                    );
                }
            }

            if (matches.length === 0) {
                const externalMatches = entries.filter(
                    (entry) => entry.externalId === respondent.externalId
                );

                if (externalMatches.length === 1) {
                    matches = externalMatches;
                } else if (externalMatches.length > 1) {
                    console.warn(`Ambiguous SupplierEntry match for externalId=${respondent.externalId}`);
                    continue;
                }
            }

            for (const match of matches) {
                matchedEntryIds.add(match.id);
            }
        }

        const matchedEntries = entries.filter((entry) => matchedEntryIds.has(entry.id));

        const completeRespondents = new Set<string>();
        const terminateRespondents = new Set<string>();
        const overQuotaRespondents = new Set<string>();
        const oeOverQuotaRespondents = new Set<string>();

        for (const entry of matchedEntries) {

            const key = `${entry.externalId}|${entry.supplierCode}`;
            if (entry.finalOutcome === "COMPLETE") {
                completeRespondents.add(key);
            }
            if (entry.finalOutcome === "TERMINATE" ||
                entry.finalOutcome === "QUALITY_TERM") {
                terminateRespondents.add(key);
            }
            if (entry.finalOutcome === "OVER_QUOTA" &&
                entry.finalSource === "SURVEY_CALLBACK") {
                overQuotaRespondents.add(key);
            }
            if (entry.finalOutcome === "OVER_QUOTA" &&
                entry.finalSource === "QUOTA_LIMIT") {
                oeOverQuotaRespondents.add(key);
            }
        }

        const completes = completeRespondents.size;
        const terminates = terminateRespondents.size;
        const overQuotas = overQuotaRespondents.size;
        const oeOverQuotas = oeOverQuotaRespondents.size;

        const quotaPercent = quota.targetCompletes > 0 ? (completes / quota.targetCompletes) * 100 : 0;

        const status = quota.targetCompletes > 0 &&
                       completes >= quota.targetCompletes
                           ? "Close"
                           : "Open";

        await prisma.projectQuota.update({
            where: { id: quota.id },
            data: {
                quotaCount,
                //totalAccesses: quotaCount, // Assuming totalAccesses is the same as quotaCount for this example
                prescreenClicks,
                completes,
                terminates,
                overQuotas,
                oeOverQuotas,
                quotaPercent: Number(quotaPercent.toFixed(2)), // Round to 2 decimal places
                status,
            },
        });
    }

    return await prisma.projectQuota.findMany({
        where: { projectId },
        orderBy: { sortOrder: "asc" },
    });
}
