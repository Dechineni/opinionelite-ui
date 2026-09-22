export function isProjectTypeImmutable(
  currentType: string,
  requestedType: string
) {
  return currentType === requestedType;
}
