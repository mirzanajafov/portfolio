ALTER TABLE "DailyVisits" ADD COLUMN "didDemoStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "openedDemo" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "DailyDemo" (
    "day" DATE NOT NULL,
    "demo" TEXT NOT NULL,
    "clicked" INTEGER NOT NULL,
    "fromSite" INTEGER NOT NULL,
    "clickedNotOpened" INTEGER NOT NULL,
    "demoOnly" JSONB NOT NULL,
    "didStep" INTEGER NOT NULL,
    "steps" JSONB NOT NULL,
    "activeSeconds" INTEGER[],

    CONSTRAINT "DailyDemo_pkey" PRIMARY KEY ("day","demo")
);
