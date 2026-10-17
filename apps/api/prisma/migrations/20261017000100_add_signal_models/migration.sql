-- CreateTable
CREATE TABLE "SignalObservation" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "sourceSymbol" TEXT NOT NULL,
    "targetSymbol" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousState" TEXT,
    "currentState" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "risk" TEXT,
    "setupSnapshot" JSONB NOT NULL,
    "aiDecision" TEXT,
    "reasons" JSONB NOT NULL,
    "rejections" JSONB NOT NULL,
    "usdcAvailable" BOOLEAN NOT NULL,
    "pairValidation" JSONB NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "timeframeInfo" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalTransition" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignalObservation_symbol_idx" ON "SignalObservation"("symbol");

-- CreateIndex
CREATE INDEX "SignalObservation_observedAt_idx" ON "SignalObservation"("observedAt");

-- CreateIndex
CREATE INDEX "SignalTransition_symbol_idx" ON "SignalTransition"("symbol");

-- CreateIndex
CREATE INDEX "SignalTransition_observedAt_idx" ON "SignalTransition"("observedAt");
