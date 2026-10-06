export function isUsableExternalId(
    value: string | null | undefined
): boolean {
    const v = String(value ?? "").trim();

    if (!v) return false;

    const normalized = v.toLowerCase();

    return (
        normalized !== "[identifier]" &&
        normalized !== "{identifier}" &&
        normalized !== "identifier"
    );
}
