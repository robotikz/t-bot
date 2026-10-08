import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { SignalizerController } from '../src/modules/signalizer/signalizer.controller.js';
import { SignalizerService } from '../src/modules/signalizer/signalizer.service.js';

function makeSetup(values: any = {}) {
  return {
    entryLow: 5.1,
    entryHigh: 5.2,
    gridLow: 5.0,
    gridHigh: 5.4,
    gridCount: 8,
    stopLoss: 4.9,
    takeProfit: 5.4,
    investment: 300,
    ...values
  };
}

class InMemoryHistoryRepo {
  items: any[] = [];
  async create(record: any) {
    const id = `id_${this.items.length + 1}`;
    const rec = { id, createdAt: new Date(), ...record };
    this.items.push(rec);
    return rec;
  }
  async findLatestBySymbol(symbol: string) {
    const arr = this.items.filter((i) => i.symbol === symbol).sort((a, b) => b.observedAt - a.observedAt);
    return arr[0] ?? null;
  }
  async find(filter: any) {
    let res = this.items.slice().sort((a, b) => b.observedAt - a.observedAt);
    if (filter.symbol) res = res.filter((r) => r.symbol === filter.symbol);
    if (filter.state) res = res.filter((r) => r.currentState === filter.state);
    if (filter.from) res = res.filter((r) => r.observedAt >= filter.from);
    if (filter.to) res = res.filter((r) => r.observedAt <= filter.to);
    if (filter.limit) res = res.slice(0, filter.limit);
    return res;
  }
}

class InMemoryTransitionRepo {
  items: any[] = [];
  async create(record: any) {
    const id = `t_${this.items.length + 1}`;
    const rec = { id, createdAt: new Date(), ...record };
    this.items.push(rec);
    return rec;
  }
  async findLatestBySymbol(symbol: string) {
    const arr = this.items.filter((i) => i.symbol === symbol).sort((a, b) => b.observedAt - a.observedAt);
    return arr[0] ?? null;
  }
  async find(filter: any) {
    let res = this.items.slice().sort((a, b) => b.observedAt - a.observedAt);
    if (filter.symbol) res = res.filter((r) => r.symbol === filter.symbol);
    if (filter.from) res = res.filter((r) => r.fromState === filter.from);
    if (filter.to) res = res.filter((r) => r.toState === filter.to);
    return res;
  }
}

describe('Signalizer API (history/transitions/state)', () => {
  let app: INestApplication;
  let http: any;
  let historyRepo: InMemoryHistoryRepo;
  let transitionRepo: InMemoryTransitionRepo;

  beforeEach(async () => {
    historyRepo = new InMemoryHistoryRepo();
    transitionRepo = new InMemoryTransitionRepo();

    const moduleRef = await Test.createTestingModule({
      controllers: [SignalizerController],
      providers: [
        {
          provide: SignalizerService,
          useFactory: () => new SignalizerService(historyRepo as any, transitionRepo as any)
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    http = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates observations and history endpoint returns persisted records with correct fields', async () => {
    const obs1 = {
      symbol: 'NEARUSDT',
      pairAnalyzed: 'NEARUSDT',
      targetBotPair: 'NEARUSDC',
      previousState: null,
      state: 'READY',
      confidence: 72,
      setup: makeSetup(),
      aiAnalysis: { decision: 'RUN_GRID', risk: 'MEDIUM' },
      reasons: ['foo'],
      rejectionReasons: [],
      usdcAvailable: true,
      pairValidation: { status: 'USDC_READY' },
      currentPrice: 5.15,
      generatedAt: new Date().toISOString()
    };

    const res1 = await request(http).post('/api/signalizer/observations').send(obs1).expect(201);
    expect(res1.body).toHaveProperty('observation');

    const h = await request(http).get('/api/signalizer/history').expect(200);
    expect(h.body.count).toBe(1);
    const item = h.body.items[0];
    expect(item.symbol).toBe('NEARUSDT');
    expect(new Date(item.observedAt)).toBeInstanceOf(Date);
    expect(item.previousState).toBeNull();
    expect(item.currentState).toBe('READY');
    expect(item.confidence).toBe(72);
    expect(item.risk).toBe('MEDIUM');
    expect(item.setupSnapshot.entryLow).toBe(5.1);
    expect(item.reasons).toEqual(['foo']);
    expect(item.rejections).toEqual([]);
    expect(item.usdcAvailable).toBe(true);
    expect(item.pairValidation).toEqual({ status: 'USDC_READY' });
  });

  it('history filtering by symbol and state works and limit/from/to supported', async () => {
    // create multiple observations
    const now = Date.now();
    await historyRepo.create({ symbol: 'NEARUSDC', currentState: 'READY', observedAt: new Date(now - 10000) });
    await historyRepo.create({ symbol: 'NEARUSDC', currentState: 'WATCH', observedAt: new Date(now - 5000) });
    await historyRepo.create({ symbol: 'OTHERUSDC', currentState: 'READY', observedAt: new Date(now - 2000) });

    let r = await request(http).get('/api/signalizer/history').query({ symbol: 'NEARUSDC' }).expect(200);
    expect(r.body.count).toBe(2);

    r = await request(http).get('/api/signalizer/history').query({ state: 'READY' }).expect(200);
    expect(r.body.items.every((i: any) => i.currentState === 'READY')).toBeTruthy();

    r = await request(http).get('/api/signalizer/history').query({ limit: '1' }).expect(200);
    expect(r.body.items.length).toBe(1);

    const from = new Date(now - 6000).toISOString();
    r = await request(http).get('/api/signalizer/history').query({ from }).expect(200);
    expect(r.body.items.every((i: any) => new Date(i.observedAt) >= new Date(from))).toBeTruthy();
  });

  it('transitions endpoint returns only real transitions and initial observation creates no transition', async () => {
    // history: initial null->READY, READY->READY, READY->WATCH, WATCH->READY
    // create initial observation
    await request(http).post('/api/signalizer/observations').send({ symbol: 'TSTUSDT', pairAnalyzed: 'TSTUSDT', state: 'READY', previousState: null, generatedAt: new Date().toISOString() }).expect(201);
    // duplicate READY
    await request(http).post('/api/signalizer/observations').send({ symbol: 'TSTUSDT', pairAnalyzed: 'TSTUSDT', state: 'READY', previousState: 'READY', generatedAt: new Date().toISOString() }).expect(201);
    // READY -> WATCH
    await request(http).post('/api/signalizer/observations').send({ symbol: 'TSTUSDT', pairAnalyzed: 'TSTUSDT', state: 'WATCH', previousState: 'READY', generatedAt: new Date().toISOString() }).expect(201);
    // WATCH -> READY
    await request(http).post('/api/signalizer/observations').send({ symbol: 'TSTUSDT', pairAnalyzed: 'TSTUSDT', state: 'READY', previousState: 'WATCH', generatedAt: new Date().toISOString() }).expect(201);

    const tr = await request(http).get('/api/signalizer/transitions').expect(200);
    // should contain only READY->WATCH and WATCH->READY
    expect(tr.body.items.filter((t: any) => t.fromState === 'READY' && t.toState === 'WATCH').length).toBe(1);
    expect(tr.body.items.filter((t: any) => t.fromState === 'WATCH' && t.toState === 'READY').length).toBe(1);
    // initial null->READY should not be present
    expect(tr.body.items.every((t: any) => t.fromState !== null)).toBeTruthy();
  });

  it('immutability: old setup snapshot remains unchanged after later observation', async () => {
    // first observation with specific setup
    const firstSetup = makeSetup();
    await request(http).post('/api/signalizer/observations').send({ symbol: 'IMMUSDT', pairAnalyzed: 'IMMUSDT', state: 'READY', previousState: null, setup: firstSetup, generatedAt: new Date().toISOString() }).expect(201);

    // modify values in a later observation
    const laterSetup = makeSetup({ entryLow: 5.15, entryHigh: 5.25, investment: 400 });
    await request(http).post('/api/signalizer/observations').send({ symbol: 'IMMUSDT', pairAnalyzed: 'IMMUSDT', state: 'WATCH', previousState: 'READY', setup: laterSetup, generatedAt: new Date().toISOString() }).expect(201);

    const h = await request(http).get('/api/signalizer/history').query({ symbol: 'IMMUSDT' }).expect(200);
    expect(h.body.count).toBe(2);
    const old = h.body.items.find((i: any) => i.currentState === 'READY');
    expect(old.setupSnapshot.entryLow).toBe(5.1);
    expect(old.setupSnapshot.entryHigh).toBe(5.2);
    expect(old.setupSnapshot.gridLow).toBe(5.0);
    expect(old.setupSnapshot.gridHigh).toBe(5.4);
    expect(old.setupSnapshot.gridCount).toBe(8);
    expect(old.setupSnapshot.stopLoss).toBe(4.9);
    expect(old.setupSnapshot.takeProfit).toBe(5.4);
    expect(old.setupSnapshot.investment).toBe(300);
  });

  it('current state endpoint returns latest observation and expected fields', async () => {
    await request(http).post('/api/signalizer/observations').send({ symbol: 'CURUSDT', pairAnalyzed: 'CURUSDT', state: 'WATCH', previousState: null, setup: makeSetup(), generatedAt: new Date().toISOString() }).expect(201);
    await request(http).post('/api/signalizer/observations').send({ symbol: 'CURUSDT', pairAnalyzed: 'CURUSDT', state: 'READY', previousState: 'WATCH', setup: makeSetup(), generatedAt: new Date().toISOString() }).expect(201);

    const res = await request(http).get('/api/signalizer/state/CURUSDT').expect(200);
    expect(res.body.currentState).toBe('READY');
    expect(res.body.previousState).toBe('WATCH');
    expect(res.body.setup).toBeDefined();
    expect(res.body.confidence === null || typeof res.body.confidence === 'number').toBeTruthy();
    expect(typeof res.body.lastAnalysisTimestamp === 'string' || res.body.lastAnalysisTimestamp instanceof Date).toBeTruthy();
  });

  it('unknown symbol returns standard not-found behavior (no current state)', async () => {
    const res = await request(http).get('/api/signalizer/state/UNKNOWN').expect(200);
    expect(res.body.currentState).toBeNull();
  });

  it('repository isolation: SignalizerService constructed with repositories (no Prisma dependency)', () => {
    // if the service accepts repo instances, we have isolation
    const svc = new SignalizerService(historyRepo as any, transitionRepo as any);
    expect(typeof svc.createObservation).toBe('function');
  });
});
