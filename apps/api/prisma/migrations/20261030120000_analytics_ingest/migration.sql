CREATE TABLE "Visit" (
    "visitor" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("visitor")
);

CREATE TABLE "PageView" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitor" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "notFound" BOOLEAN NOT NULL DEFAULT false,
    "referrerHost" TEXT,
    "ref" TEXT,
    "readSeq" INTEGER NOT NULL DEFAULT 0,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "maxScroll" INTEGER NOT NULL DEFAULT 0,
    "blocks" JSONB NOT NULL DEFAULT '{}',
    "lcpMs" INTEGER,
    "inpMs" INTEGER,
    "cls" DOUBLE PRECISION,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkClick" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewId" UUID NOT NULL,
    "href" TEXT NOT NULL,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientError" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "line" INTEGER,
    "column" INTEGER,

    CONSTRAINT "ClientError_pkey" PRIMARY KEY ("id")
);

CREATE UNLOGGED TABLE "VisitorSalt" (
    "day" DATE NOT NULL,
    "salt" BYTEA NOT NULL,

    CONSTRAINT "VisitorSalt_pkey" PRIMARY KEY ("day")
);

CREATE TABLE "DroppedEvents" (
    "day" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DroppedEvents_pkey" PRIMARY KEY ("day","reason")
);

CREATE INDEX "Visit_startedAt_idx" ON "Visit"("startedAt");

CREATE INDEX "PageView_visitor_idx" ON "PageView"("visitor");

CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

CREATE INDEX "PageView_ref_idx" ON "PageView"("ref");

CREATE INDEX "LinkClick_viewId_idx" ON "LinkClick"("viewId");

CREATE INDEX "ClientError_viewId_idx" ON "ClientError"("viewId");

ALTER TABLE "PageView" ADD CONSTRAINT "PageView_visitor_fkey" FOREIGN KEY ("visitor") REFERENCES "Visit"("visitor") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "PageView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientError" ADD CONSTRAINT "ClientError_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "PageView"("id") ON DELETE CASCADE ON UPDATE CASCADE;
