CREATE TYPE "ApplicationChannel" AS ENUM ('referral', 'direct', 'recruiter');

CREATE TYPE "ApplicationStatus" AS ENUM ('sent', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn');

CREATE TYPE "ApplicationField" AS ENUM ('status', 'channel', 'cvVariant', 'answeredOn', 'notes', 'company', 'role');

ALTER TABLE "Application" ADD COLUMN "answeredOn" DATE,
ADD COLUMN "channel" "ApplicationChannel" NOT NULL DEFAULT 'direct',
ADD COLUMN "cvVariant" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "status" "ApplicationStatus" NOT NULL DEFAULT 'sent';

ALTER TABLE "Application" ALTER COLUMN "channel" DROP DEFAULT,
ALTER COLUMN "cvVariant" DROP DEFAULT;

CREATE TABLE "ApplicationChange" (
    "id" SERIAL NOT NULL,
    "applicationId" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "field" "ApplicationField" NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "undo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ApplicationChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApplicationChange_applicationId_id_idx" ON "ApplicationChange"("applicationId", "id");

ALTER TABLE "ApplicationChange" ADD CONSTRAINT "ApplicationChange_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
