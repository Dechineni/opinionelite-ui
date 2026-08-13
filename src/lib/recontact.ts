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
