export function resolveEffectiveRecid(
  incomingRecid?: string | null,
  storedRecid?: string | null
) {
  if (incomingRecid?.trim()) {
    return incomingRecid.trim();
  }

  if (storedRecid?.trim()) {
    return storedRecid.trim();
  }

  return "";
}
/**
 * Build a unique tracking key based on external id.
 * Same recid is allowed as long as external ids differ.
 */
export function buildExternalIdRecidKey(
  externalId: string,
  recid: string
) {
  return `${externalId}:${recid}`;
}
