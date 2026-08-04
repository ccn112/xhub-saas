-- Security/privacy audit remediation (SEC-003, 2026-08-04): optional
-- client-supplied idempotency key on Request/Ticket/Booking/Directive/
-- Announcement create, matching the pattern already proven on LeaveRequest.
-- Nullable + unique(tenantId, idempotencyKey) — Postgres treats multiple NULLs
-- as distinct, so this is backward-compatible (no key = no replay guard).

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Directive" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_tenantId_idempotencyKey_key" ON "Announcement"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_tenantId_idempotencyKey_key" ON "Booking"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Directive_tenantId_idempotencyKey_key" ON "Directive"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Request_tenantId_idempotencyKey_key" ON "Request"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_tenantId_idempotencyKey_key" ON "Ticket"("tenantId", "idempotencyKey");
