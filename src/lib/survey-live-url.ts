export function replaceTokens(
  template: string,
  map: Record<string, string>
) {
  return template
    .replace(/\[([^\]]+)\]/g, (_, key) => map[key] ?? "")
    .replace(/\{([^}]+)\}/g, (_, key) => map[key] ?? "");
}
