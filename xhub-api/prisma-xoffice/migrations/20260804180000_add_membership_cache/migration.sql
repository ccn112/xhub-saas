-- Phase 1.5 Stage C follow-up (2026-08-04): local read-cache of Membership,
-- synced from XHub Platform by IdentitySyncService. Closes the live
-- cross-process Postgres dependency that AuthService.sessionMembershipActive()
-- previously had on the Platform database.
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");
