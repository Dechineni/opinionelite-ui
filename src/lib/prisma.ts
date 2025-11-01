// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";

// Fail fast if missing
const connectionString = process.env.DATABASE_URL!;
if (!connectionString) throw new Error("DATABASE_URL is missing");

// Adapter for Neon HTTP (Edge/Workers safe)
const adapter = new PrismaNeonHTTP(connectionString, {});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
