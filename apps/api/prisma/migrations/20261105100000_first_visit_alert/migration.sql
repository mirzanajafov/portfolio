ALTER TABLE "Application" ADD COLUMN "firstSeenOn" DATE;

CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GivenUpAlerts" (
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "GivenUpAlerts_pkey" PRIMARY KEY ("day")
);

CREATE INDEX "Alert_nextAttemptAt_idx" ON "Alert"("nextAttemptAt");
