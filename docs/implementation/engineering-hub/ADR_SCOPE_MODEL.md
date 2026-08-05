# ADR — Scope Model for DG-01 (Product Registry + Version Core)

**Status:** PROPOSED — draft ready for review.
**Date:** 2026-08-05.

## Decision

`Product`, `ProductComponent`, `RepositoryConnection`, `Environment`,
`ProductVersion`, `ReleaseTrain` are **platform-wide registries**, not
tenant-scoped data. Every row carries `scopeType` (fixed `'PLATFORM'` for
this entire DG-01 slice) per `CLAUDE.md`'s blanket base-field rule, but
**none of these tables are added to `scripts/rls-setup.mjs`'s
`TENANT_TABLES` list**, and no `tenant_isolation` RLS policy is applied to
them.

## Rationale

This mirrors an existing, already-established precedent in the exact same
database: `Tenant`, `ApplicationDefinition`, `Blueprint`, `SeedPack`,
`SubscriptionPlan` are all canonical, platform-wide registries that already
live in `prisma/schema.prisma` **without** RLS tenant-scoping — they describe
things that exist once across the whole platform, not once per tenant. A
`Product` (e.g. "XHUB", "X2/XBuilding") is the same kind of object: it does
not belong to any single tenant, and every tenant that has that product
provisioned should see the identical registry entry, not a tenant-scoped
copy.

This is NOT an oversight or a shortcut — it's the correct application of the
handoff's own `docs/11_SECURITY_TENANCY_AUDIT.md` scope model
(`PLATFORM | TENANT | DELIVERY_PROJECT`), which distinguishes "platform data"
explicitly from "tenant data" and says platform-scoped data uses "a separate
permission boundary (no casual bypass)" rather than RLS. For DG-01, that
permission boundary is `@RequirePermission('engineering.product.read'/
'.manage')` at the route/guard layer (RBAC), the same mechanism every other
Platform-only route in this codebase already uses (`controlplane`, `mdm`,
etc., none of which are RLS tenant-scoped either).

## What this does NOT decide

- Later DG phases introduce genuinely tenant-scoped or delivery-project-scoped
  entities (`TenantProductDeployment`, UAT campaigns run *for* a specific
  tenant, `DELIVERY_PROJECT`-scoped requirement gaps). Those tables **will**
  need real `scopeType`-aware RLS (or an equivalent object-authorization
  check) when they're built — this ADR only covers the DG-01 registry core,
  which is platform-wide by nature. `scopeType`/`scopeId` columns are added
  now, unused-but-present, specifically so those later tables can extend the
  same base shape without a schema rewrite.
- `TenantProductDeployment` (which tenant runs which product/version) is
  listed in the handoff's domain model but is explicitly **out of scope for
  DG-01** (see `IMPLEMENTATION_PLAN.md`) — it's a DG-08 (ecosystem rollout)
  concern once other products actually onboard. Not built this pass.

## Consequences

- `scripts/rls-test.mjs`'s table count stays unchanged by this ADR (no new
  RLS-tracked tables) — the new DG-01 tables are verified only by ordinary
  Prisma-level tests (`test:engineering-products`), not `test:rls`.
- If a future session decides these registries should in fact be
  tenant-visible-but-tenant-scoped (e.g., a tenant sees a filtered product
  catalog of what they're entitled to), that's a `TenantProductDeployment`
  read-projection on top of this registry, not a re-scoping of `Product`
  itself.
