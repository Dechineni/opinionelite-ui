// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless"; // optional, for caching

neonConfig.fetchConnectionCache = true; // optional, helps on serverless/edge

type Global = { prisma?: PrismaClient };
const globalForPrisma = globalThis as unknown as Global;

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  // ✅ v6.18 expects (connectionString: string, options: object)
  const adapter = new PrismaNeonHTTP(url, {});

  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

  return globalForPrisma.prisma;
}

export const prisma = getPrisma();