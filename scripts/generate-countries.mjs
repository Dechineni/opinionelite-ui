// scripts/generate-countries.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import countries from "world-countries";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// output: src/data/countries.ts
const outPath = path.resolve(__dirname, "..", "src", "data", "countries.ts");

// transform: world-countries -> { code, name, languages[] }
const list = countries
  .map((c) => {
    const langs = c.languages
      ? Object.entries(c.languages).map(([code, name]) => ({ code, name }))
      : [];

    // Ensure English is present as 'en' for every country
    if (!langs.some((l) => l.code === "en"))
      langs.push({ code: "en", name: "English" });

    langs.sort((a, b) => a.name.localeCompare(b.name));
    return {
      code: c.cca2,              // e.g. "US"
      name: c.name.common,       // e.g. "United States"
      languages: langs,
    };
  })
  .filter((c) => c.code && c.name)
  .sort((a, b) => a.name.localeCompare(b.name));

const out = `// AUTO-GENERATED FILE. Do not edit by hand.
// Source: world-countries. Run \`pnpm gen:countries\` to regenerate.

export type Language = { code: string; name: string };
export type Country  = { code: string; name: string; languages: Language[] };

export const COUNTRIES: Country[] = ${JSON.stringify(list, null, 2)};

export const getCountry = (code?: string) =>
  COUNTRIES.find((c) => c.code === code);

export const getLanguagesForCountry = (code?: string): Language[] => {
  const c = getCountry(code);
  if (!c) return [];
  const map = new Map(c.languages.map((l) => [l.code, l]));
  if (!map.has("en")) map.set("en", { code: "en", name: "English" });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, "utf8");
console.log(
  `Generated ${path.relative(process.cwd(), outPath)} with ${list.length} countries`
);