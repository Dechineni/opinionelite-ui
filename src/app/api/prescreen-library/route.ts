// FILE: src/app/api/prescreen-library/route.ts
export const runtime = "edge";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import {
  getLibraryProfiles,
  getLibraryQuestions,
  isLibraryProfileKey,
  type LibraryProfileKey,
} from "@/lib/prescreenlibrary";

// GET /api/prescreen-library
//   -> { profiles: [...] }
// GET /api/prescreen-library?profile=travel
//   -> { profile: {key,name}, questions: [...] }
export async function GET(req: Request) {
  const url = new URL(req.url);
  const profileParam = (url.searchParams.get("profile") || "").trim();

  if (!profileParam) {
    return NextResponse.json({ profiles: getLibraryProfiles() });
  }

  if (!isLibraryProfileKey(profileParam)) {
    return NextResponse.json(
      { error: `Unknown profile '${profileParam}'.` },
      { status: 400 }
    );
  }

  const profiles = getLibraryProfiles();
  const profile = profiles.find((p) => p.key === profileParam)!;
  const questions = getLibraryQuestions(profileParam as LibraryProfileKey);

  return NextResponse.json({ profile, questions });
}
