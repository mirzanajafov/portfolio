ALTER TABLE "AskLog" ADD COLUMN "visitor" TEXT;

CREATE INDEX "AskLog_visitor_idx" ON "AskLog"("visitor");
