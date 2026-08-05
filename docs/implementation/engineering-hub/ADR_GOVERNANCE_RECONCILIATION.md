# ADR — Reconciling XHUB_SOFTWARE_AI_GOVERNANCE_AUDIT_READY_HANDOFF_20260805 with the live engineering-governance module

Status: DECIDED (2026-08-05), by explicit user instruction after reviewing
a survey of the handoff against this repo's real code.

## Context

On 2026-08-05, three new handoff packages were reviewed against the
already-live `xhub-api/src/engineering/` module (DG-00→06, built earlier
the same day):

1. `XHUB_SOFTWARE_AI_GOVERNANCE_AUDIT_READY_HANDOFF_20260805` — a paper
   design package (no code) proposing a Product/Backlog/Version/Release/
   Test/Change/Defect domain model, plus genuinely new domains (AI
   Governance, Privacy/DPIA, Unified Control Framework, Evidence Ledger/
   Audit Room).
2. `XHUB_TAILUX_CLAUDE_SKILL_HANDOFF_20260805` — a Tailux UX-pattern skill,
   unrelated to this ADR (blocked on a not-yet-supplied vendor asset; see
   the memory note from that review round, not part of this reconciliation).
3. `XHUB_UNIFIED_AUDIT_SURVEY_AND_PRODUCT_INTAKE_20260805` — a survey
   questionnaire/template kit meant to run alongside package (1), inheriting
   the same schema.

A two-agent survey (see the session transcript, 2026-08-05) found that
package (1)'s own Product/Backlog/Version/Release/Test/Change/Defect schema
(`contracts/*.schema.json`, `docs/02`/`docs/03`) is a **conflicting
redesign**, not a compatible extension, of the schema already live in
`xhub-api/prisma/schema.prisma` (different field names, different FSMs,
mandatory `tenantId` vs. this module's deliberate platform-wide/no-RLS
design — see `ADR_SCOPE_MODEL.md`). The package shows **zero awareness**
that DG-01/02/04/05/06 already exist and are running (no reference to
`xhub-api`, `/api/engineering`, or DG-phase naming anywhere in its 71
files) — it was authored on a green-field assumption layered only on top of
`Audit260803`.

## Decision

1. **Reject** package (1)'s Product/Backlog/Version/Release/Test/Change/
   Defect redesign. Do not migrate, do not rename fields, do not adopt its
   FSMs. The already-live DG-01/02/04/05/06 schema and API stand as-is.
2. **Adopt, additively, in this codebase's own conventions**, the four
   genuinely new domains that have no equivalent in the already-built
   module:
   - DG-09 — Unified Control Framework (`Control`/`ControlImplementation`)
   - DG-10 — AI Governance (`AISystem`/`AIImpactAssessment`)
   - DG-11 — Privacy/DPIA (`ProcessingActivity`/`PrivacyImpactAssessment`)
   - DG-12-lite — Evidence Ledger (`Evidence`)
   Each uses this module's established conventions: platform-wide,
   `withBypass` only, no RLS/tenant scoping, loose string cross-references
   (no hard `@relation` where it would force joining across unrelated
   subsystems), simple status enums with a small explicit FSM only where a
   real approval gate matters (impact assessments), `standardsRefs`-style
   citation arrays — NOT the handoff's own `tenantId`-mandatory,
   heavily-relational contract shapes.
3. **Do not adopt** package (1)'s remaining scope in this pass: full
   Evidence maturity taxonomy verbatim (E2–E5 names are this session's own
   reasonable interpretation, not a copy of any copyrighted source text —
   only E1/E6 names were confirmed from the survey), the 9-gate lifecycle
   engine (`GATE_CATALOG.csv`/`GATE_RACI.csv`), Application/Release
   criticality tiers on `Product`, `ChangeRequest` as a first-class entity,
   or the `docs/16` migration of Audit260803's registers into typed
   objects — none of these were requested for this pass; they remain
   options for a later phase if explicitly asked for.
4. Package (3)'s `MASTER_AUDIT_QUESTIONNAIRE.csv` (97 real, standards-tagged
   questions) is usable as a standalone survey checklist independent of
   this decision — it does not require adopting package (1)'s schema. Not
   imported into any table this pass; flagged for a future DG-13-ish
   "survey round" phase if requested.

## Consequences

- No breaking change to any DG-01/02/04/05/06 route, model, or UI.
- Four new Prisma models + 4 new controllers/services, all additive, all
  registered in the SAME `engineering.module.ts` (still Platform-only,
  still no RLS — see `ADR_SCOPE_MODEL.md`, unchanged).
- The legal-citation gap the survey surfaced (superseded Nghị định
  13/2023/NĐ-CP) was fixed independently of this schema decision — see
  `seed-data/engineering/documents.seed.json`'s `XHUB-SEC-STANDARDS`
  document, version 2 (2026-08-05).
- If a future session wants the rejected pieces (gate engine, criticality
  tiers, ChangeRequest, full Evidence maturity model verbatim), that is a
  new, explicit decision — this ADR does not preclude it, it only states
  what was NOT done in this pass and why.
