require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const exchanges = ['BINANCE', 'BYBIT', 'OKX'];

  for (const name of exchanges) {
    await prisma.exchange.upsert({
      where: { name },
      update: {},
      create: { name, enabled: true },
    });
  }

  const strategies = [
    { name: 'EMA', description: 'Exponential moving average' },
    { name: 'RSI', description: 'Relative strength index' },
    { name: 'Grid', description: 'Grid trading' },
    { name: 'DCA', description: 'Dollar-cost averaging' },
  ];

  for (const s of strategies) {
    await prisma.strategy.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, description: s.description, enabled: true },
    });
  }

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
