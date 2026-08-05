# DECISIONS_LOG — `docs/19_DECISIONS_REQUIRED.md` responses

**Status:** All items below are **PROPOSED using the handoff's own stated
default** — none are self-chosen departures from the source material, and
none are treated as final/binding. Per the master handoff's own rule set
(`CLAUDE.md`, matching this session's own established practice for every
prior handoff's open questions): I do not sign off on organizational or
business decisions for the project owner. Where a decision materially
affects work scheduled for DG-02 or later, it is flagged again in
`IMPLEMENTATION_PLAN.md` at the point it actually gates that phase.

| # | Decision | Handoff's default | Status | Gates |
|---|---|---|---|---|
| 1 | Tên module | "Phát triển & Chất lượng" | **Adopted** (low-stakes, cosmetic) | — |
| 2 | Issue/Backlog System-of-Record | XHub canonical; external issues (GitHub Issues/Jira) mapped in, not dual-authoritative | PROPOSED | DG-02 (Feature/Backlog) — must be re-confirmed before that phase starts, since it shapes the traceability model |
| 3 | First Git provider | GitHub (private) | **Adopted** — matches this repo's actual remote (`ccn112/xhub-saas`, already private) | DG-06 (Git/CI integration) |
| 4 | AI code execution scope | Claude Code sandbox/PR only in phase 1 | PROPOSED | DG-07 (AI Engineering Copilot) |
| 5 | Evidence storage | Dedicated namespace, not reusing an existing bucket | **Adopted, refined** — see `ADR_MODULE_OWNERSHIP.md`: dedicated Platform-side model/table, mirroring `records`' pattern rather than sharing its database | DG-04/DG-07 |
| 6 | Tenant visibility into backlog | Tenants see only published campaigns/feedback/release notes — not internal backlog or security findings | PROPOSED | DG-02/DG-05 |
| 7 | Release approval authority | Not specified by the handoff beyond "human release approval" as a named gate; concrete approver role(s) is an organizational choice | **Open** | DG-05/DG-06 (release readiness cockpit) |
| 8 | P0/P1 fixer/verifier independence | Handoff assumes some segregation-of-duties policy exists but doesn't mandate a specific rule | **Open** | DG-05 (Defect FSM `VERIFIED` gate) |
| 9 | X.Space integration | Deep-link to channel only (not embedded context-aware comments) — matches this session's separate finding that X.Space's own architecture is "chốt riêng" (decided independently, out of this repo's current scope) | **Adopted** | DG-08 (ecosystem rollout) — moot until X.Space is actually onboarded |
| 10 | Rollout order | XHUB → X.Office → X2/XBuilding → X1/XBooking → FinERP → X.Space (`data/SEED_PRODUCTS.csv`) | **Adopted for seed ordering only** — DG-01 seeds all 6 product *registry entries* in this order for completeness, but does **not** build anything beyond the registry row for products 2-6 this pass (no live integration, no repo connector) | DG-08 (actual rollout) |

## What DG-01 actually needs from this table (and nothing more)

Only #3, #5, #9, #10 are "adopted" outright because they either match the
existing codebase already (#3, #9) or are resolved by the ADR itself (#5), or
only affect ordering of inert seed rows (#10). #2, #4, #6, #7, #8 are
recorded as proposed defaults **for visibility**, but none of them block or
change anything DG-01 builds — they matter starting at DG-02/04/05/06/07,
where they will be raised again explicitly before that phase's implementation
plan is finalized, not assumed silently.
