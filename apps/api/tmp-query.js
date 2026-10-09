require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL;
if(!url){
  console.error('DATABASE_URL not set');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url } }});

(async () => {
  try{
    await prisma.$connect();
    const transitions = await prisma.signalTransition.findMany({ where: { symbol: 'PGCONCURUSDT' } });
    const observations = await prisma.signalObservation.findMany({ where: { symbol: 'PGCONCURUSDT' }, orderBy: { observedAt: 'asc' } });
    console.log('transitions.count=', transitions.length);
    console.log(JSON.stringify(transitions, null, 2));
    console.log('observations.count=', observations.length);
    console.log(JSON.stringify(observations.map(o=>({id:o.id,currentState:o.currentState,observedAt:o.observedAt,previousState:o.previousState})), null, 2));
  }catch(e){
    console.error('ERROR', e);
    process.exit(1);
  }finally{
    await prisma.$disconnect();
  }
})();
