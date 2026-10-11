import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL env required');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

;(async () => {
  try {
    await prisma.$connect();
    const symbol = 'PGCONCURUSDT';
    const transitions = await prisma.signalTransition.findMany({ where: { symbol } });
    const observations = await prisma.signalObservation.findMany({ where: { symbol }, orderBy: { observedAt: 'asc' } });
    console.log(JSON.stringify({ transitions, observations }, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
