CREATE TABLE "AdminLoginToken" (
    "hash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminLoginToken_pkey" PRIMARY KEY ("hash")
);

CREATE TABLE "AdminSession" (
    "hash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("hash")
);
