CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

CREATE TABLE "AskLog" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "sentences" JSONB NOT NULL,
    "withheld" TEXT[],
    "refused" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "AskLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

CREATE INDEX "AskLog_createdAt_idx" ON "AskLog"("createdAt");
