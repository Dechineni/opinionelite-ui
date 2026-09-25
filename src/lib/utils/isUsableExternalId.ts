export function isUsableExternalId(
  externalId: string | null | undefined
) {
  const value = String(externalId ?? "")
    .trim()
    .toLowerCase();

  return ![
    "",
    "identifier",
    "[identifier]",
    "{identifier}",
  ].includes(value);
}
