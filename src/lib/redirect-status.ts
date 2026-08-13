export function canChangeProjectType(
  currentType: string,
  requestedType: string
) {
  return currentType === requestedType;
}
