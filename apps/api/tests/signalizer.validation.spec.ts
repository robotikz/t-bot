import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SignalizerController } from '../src/modules/signalizer/signalizer.controller.js';
import { SignalizerService } from '../src/modules/signalizer/signalizer.service.js';

describe('Signalizer API validation', () => {
  let app: INestApplication;
  let http: any;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SignalizerController],
      providers: [
        {
          provide: SignalizerService,
          useFactory: () => new SignalizerService({} as any, {} as any)
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    http = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects invalid state value in history query', async () => {
    await request(http).get('/api/signalizer/history').query({ state: 'INVALID_STATE' }).expect(400);
  });

  it('rejects invalid from date', async () => {
    await request(http).get('/api/signalizer/history').query({ from: 'not-a-date' }).expect(400);
  });

  it('rejects inverted date range', async () => {
    const from = new Date('2026-10-10').toISOString();
    const to = new Date('2026-10-01').toISOString();
    await request(http).get('/api/signalizer/history').query({ from, to }).expect(400);
  });

  it('rejects negative limit', async () => {
    await request(http).get('/api/signalizer/history').query({ limit: '-5' }).expect(400);
  });

  it('rejects excessive limit > 1000', async () => {
    await request(http).get('/api/signalizer/history').query({ limit: '5000' }).expect(400);
  });

  it('rejects invalid symbol format for state endpoint', async () => {
    // use a single path segment with invalid chars to hit the route and trigger validation
    await request(http).get('/api/signalizer/state/invalid$symbol').expect(400);
  });
});
