import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in the environment");
}
const adapter = new PrismaPg(databaseUrl);
export const prisma = new PrismaClient({ adapter });
export { Prisma, PrismaClient };
//# sourceMappingURL=client.js.map