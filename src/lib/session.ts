// FILE: src/lib/session.ts
import { cookies } from "next/headers";

export type Session =
  | { user: { role: "admin" | "manager"; name: string; email: string } }
  | null;

export async function getSession(): Promise<Session> {
  // ✅ dynamic header APIs must be awaited
  const jar = await cookies();

  const token = jar.get("OE_AUTH")?.value;
  if (!token) return null;

  const role = (jar.get("OE_ROLE")?.value as "admin" | "manager") ?? "manager";
  const name = jar.get("OE_NAME")?.value ?? "User";
  const email = jar.get("OE_EMAIL")?.value ?? "";

  return { user: { role, name, email } };
}