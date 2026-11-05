ALTER TABLE "Application" ADD COLUMN "firstSeenAt" TIMESTAMP(3);

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
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GivenUpAlerts_pkey" PRIMARY KEY ("day")
);

CREATE INDEX "Alert_nextAttemptAt_idx" ON "Alert"("nextAttemptAt");

UPDATE "Application" AS a SET "firstSeenAt" = LEAST(
    (SELECT min(p."createdAt") FROM "PageView" AS p WHERE p.ref = a.code),
    (SELECT min(d.day)::timestamp(3) FROM "DailyApplication" AS d WHERE d."applicationId" = a.id)
);
