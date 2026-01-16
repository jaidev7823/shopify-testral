
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.pageBaseline.count();
    console.log(`PageBaseline count: ${count}`);
    if (count > 0) {
        const baselines = await prisma.pageBaseline.findMany();
        console.log(JSON.stringify(baselines, null, 2));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
