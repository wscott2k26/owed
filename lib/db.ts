import { PrismaClient } from "@prisma/client";

declare global {
  var __owedPrisma: PrismaClient | undefined;
}

export const prisma = global.__owedPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__owedPrisma = prisma;
