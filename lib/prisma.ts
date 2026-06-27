import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
});

function makePrisma() {
    const client = new PrismaClient({
        adapter,
        log: ["error"],
    });

    return client.$extends({
        query: {
            user: {
                async create({ args, query }) {
                    const result = await query(args);
                    if (result?.id && result?.username) {
                        await client.creator.updateMany({
                            where: { userId: result.id },
                            data: { handle: result.username },
                        });
                    }
                    return result;
                },
                async update({ args, query }) {
                    const result = await query(args);
                    if (result?.id && result?.username) {
                        await client.creator.updateMany({
                            where: { userId: result.id },
                            data: { handle: result.username },
                        });
                    }
                    return result;
                },
            },
        },
    });
}

type ExtendedPrisma = ReturnType<typeof makePrisma>;

const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma | undefined };

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;