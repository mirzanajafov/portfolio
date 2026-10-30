CREATE TABLE "DailyVisits" (
    "day" DATE NOT NULL,
    "visits" INTEGER NOT NULL,
    "pageViews" INTEGER NOT NULL,
    "phoneVisits" INTEGER NOT NULL,
    "quickExits" INTEGER NOT NULL,
    "visitSeconds" INTEGER[],

    CONSTRAINT "DailyVisits_pkey" PRIMARY KEY ("day")
);

CREATE TABLE "DailyPage" (
    "day" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "visits" INTEGER NOT NULL,
    "exits" INTEGER NOT NULL,
    "notFoundViews" INTEGER NOT NULL,
    "activeSeconds" INTEGER[],
    "maxScroll" INTEGER[],
    "blockSeconds" JSONB NOT NULL,
    "lcpMs" INTEGER[],
    "inpMs" INTEGER[],
    "cls" DOUBLE PRECISION[],

    CONSTRAINT "DailyPage_pkey" PRIMARY KEY ("day","path","device")
);

CREATE TABLE "DailySource" (
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "visits" INTEGER NOT NULL,

    CONSTRAINT "DailySource_pkey" PRIMARY KEY ("day","source","host")
);

CREATE TABLE "DailyCountry" (
    "day" DATE NOT NULL,
    "country" TEXT NOT NULL,
    "visits" INTEGER NOT NULL,

    CONSTRAINT "DailyCountry_pkey" PRIMARY KEY ("day","country")
);

CREATE TABLE "DailyClick" (
    "day" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,

    CONSTRAINT "DailyClick_pkey" PRIMARY KEY ("day","path","href")
);

CREATE TABLE "DailyApplication" (
    "day" DATE NOT NULL,
    "applicationId" UUID NOT NULL,
    "visits" INTEGER NOT NULL,
    "views" INTEGER NOT NULL,

    CONSTRAINT "DailyApplication_pkey" PRIMARY KEY ("day","applicationId")
);

CREATE INDEX "DailyApplication_applicationId_idx" ON "DailyApplication"("applicationId");

ALTER TABLE "DailyApplication" ADD CONSTRAINT "DailyApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
