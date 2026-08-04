-- Phase 1.5 Stage C.1: drop the 5 cross-group `tenantId -> Tenant.id` foreign
-- keys (Workflow, WorkflowInstance, ApprovalTask, WorkflowEvent, AuditLog).
-- tenantId stays a plain column on each table (already the dominant pattern
-- for ~36 other models in this schema, e.g. Delegation/Notification/
-- CommandLog) -- the tenant-exists invariant is enforced at the application
-- layer instead of a Postgres FK, since these tables will live in a
-- physically separate database from Tenant once Stage C.2 splits the DB.
-- Purely additive/safe: drops a constraint only, no column or data change.

-- DropForeignKey
ALTER TABLE "ApprovalTask" DROP CONSTRAINT "ApprovalTask_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Workflow" DROP CONSTRAINT "Workflow_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowEvent" DROP CONSTRAINT "WorkflowEvent_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowInstance" DROP CONSTRAINT "WorkflowInstance_tenantId_fkey";
