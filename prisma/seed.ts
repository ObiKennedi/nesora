// prisma/seed.ts
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const GIFTS = [
    { name: "Rose",    emoji: "🌹", value: 500     },
    { name: "Fire",    emoji: "🔥", value: 1000    },
    { name: "Crown",   emoji: "👑", value: 5000    },
    { name: "Diamond", emoji: "💎", value: 10000   },
    { name: "Lion",    emoji: "🦁", value: 50000   },
    { name: "Galaxy",  emoji: "🌌", value: 100000  },
]

async function main() {
    console.log("Seeding gifts…")

    for (const gift of GIFTS) {
        await prisma.gift.upsert({
            where:  { name: gift.name } as any,
            update: { value: gift.value, emoji: gift.emoji, isActive: true },
            create: { name: gift.name, value: gift.value, emoji: gift.emoji, isActive: true },
        })
    }

    console.log(`✓ Seeded ${GIFTS.length} gifts`)
}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())