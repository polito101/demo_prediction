-- CreateEnum
CREATE TYPE "PaperTradeType" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "PaperPortfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceUsdc" DECIMAL(18,8) NOT NULL DEFAULT 10000,
    "initialBalance" DECIMAL(18,8) NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperPosition" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeIndex" INTEGER NOT NULL,
    "outcomeName" TEXT NOT NULL,
    "shares" DECIMAL(18,8) NOT NULL,
    "avgBuyPrice" DECIMAL(18,8) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "type" "PaperTradeType" NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeIndex" INTEGER NOT NULL,
    "outcomeName" TEXT NOT NULL,
    "shares" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "usdcAmount" DECIMAL(18,8) NOT NULL,
    "realizedPnl" DECIMAL(18,8),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaperPortfolio_userId_key" ON "PaperPortfolio"("userId");

-- CreateIndex
CREATE INDEX "PaperPosition_portfolioId_marketId_idx" ON "PaperPosition"("portfolioId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperPosition_portfolioId_marketId_outcomeIndex_key" ON "PaperPosition"("portfolioId", "marketId", "outcomeIndex");

-- CreateIndex
CREATE INDEX "PaperTrade_portfolioId_timestamp_idx" ON "PaperTrade"("portfolioId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "PaperTrade_portfolioId_marketId_idx" ON "PaperTrade"("portfolioId", "marketId");

-- AddForeignKey
ALTER TABLE "PaperPortfolio" ADD CONSTRAINT "PaperPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperPosition" ADD CONSTRAINT "PaperPosition_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PaperPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PaperPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
