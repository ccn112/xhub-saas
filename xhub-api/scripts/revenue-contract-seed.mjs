// Revenue & Contract MVP — BO-0210 full T001 X-TECH sales journey seed
// (seed:revenue-contract-journey). Loads
// seed-data/customers/revenue-contract-journey.seed.json — faithful to the
// source handoff's seed/t001-reference-journey.seed.json (opportunity,
// contract, 4 catalog items, 4 milestones). Writes FINAL states directly via
// raw SQL (bypasses the FSM services deliberately — a seed represents "the
// current state", not a replayed history) under RLS bypass, mirroring
// customers-seed.mjs. Idempotent: upsert-by natural keys where the schema
// has one (catalog code, opportunity idempotencyKey, contract number),
// existence-check-then-skip for child rows (lines/obligations/signature)
// that have none. Server does NOT need to be running.
// Run: npm run seed:revenue-contract-journey
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const seed = JSON.parse(readFileSync(join(process.cwd(), 'seed-data', 'customers', 'revenue-contract-journey.seed.json'), 'utf8'));
const { tenantId, customerCode, catalogItems, opportunity, proposal, contract } = seed;
const OPP_IDEMPOTENCY_KEY = 'seed-opp-t001-riverside';

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  const custRes = await c.query('SELECT id FROM "Customer" WHERE "tenantId" = $1 AND code = $2', [tenantId, customerCode]);
  if (custRes.rows.length === 0) throw new Error(`Customer ${customerCode} not found — run seed:customers first`);
  const customerId = custRes.rows[0].id;

  // 1. Catalog items.
  const catalogIdByCode = new Map();
  for (const item of catalogItems) {
    const res = await c.query(
      `INSERT INTO "CommercialCatalogItem" (id, "tenantId", code, name, "commercialType", "priceModel", "createdBy", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'seed', now())
       ON CONFLICT ("tenantId", code) DO UPDATE SET name = EXCLUDED.name, "commercialType" = EXCLUDED."commercialType",
         "priceModel" = EXCLUDED."priceModel", "updatedAt" = now()
       RETURNING id`,
      [tenantId, item.code, item.name, item.commercialType, item.priceModel],
    );
    catalogIdByCode.set(item.code, res.rows[0].id);
  }

  // 2. Opportunity (upsert by idempotencyKey).
  const oppRes = await c.query(
    `INSERT INTO "Opportunity" (id, "tenantId", "customerId", title, stage, "expectedAmount", currency, probability, "idempotencyKey", "createdBy", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 'seed', now())
     ON CONFLICT ("tenantId", "idempotencyKey") DO UPDATE SET stage = EXCLUDED.stage, "expectedAmount" = EXCLUDED."expectedAmount",
       probability = EXCLUDED.probability, "updatedAt" = now()
     RETURNING id`,
    [tenantId, customerId, opportunity.title, opportunity.stage, opportunity.expectedAmount, opportunity.currency, opportunity.probability, OPP_IDEMPOTENCY_KEY],
  );
  const opportunityId = oppRes.rows[0].id;

  // 3. Proposal (upsert by (tenantId, opportunityId, version)) + lines (existence-check by proposalId+catalogItemId).
  const propRes = await c.query(
    `INSERT INTO "Proposal" (id, "tenantId", "opportunityId", version, status, "requiresApproval", currency, "createdBy", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 'seed', now())
     ON CONFLICT ("tenantId", "opportunityId", "version") DO UPDATE SET status = EXCLUDED.status, "updatedAt" = now()
     RETURNING id`,
    [tenantId, opportunityId, proposal.version, proposal.status, proposal.requiresApproval, opportunity.currency],
  );
  const proposalId = propRes.rows[0].id;
  let proposalTotal = 0;
  for (const line of proposal.lines) {
    const catalogItemId = catalogIdByCode.get(line.catalogCode);
    const lineTotal = Number(line.unitPrice) * (line.quantity ?? 1) * (1 - (line.discountPercent ?? 0) / 100);
    proposalTotal += lineTotal;
    const existing = await c.query('SELECT id FROM "ProposalLine" WHERE "tenantId" = $1 AND "proposalId" = $2 AND "catalogItemId" = $3', [tenantId, proposalId, catalogItemId]);
    if (existing.rows.length > 0) continue;
    await c.query(
      `INSERT INTO "ProposalLine" (id, "tenantId", "proposalId", "catalogItemId", quantity, "unitPrice", "discountPercent", "lineTotal")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, proposalId, catalogItemId, line.quantity ?? 1, line.unitPrice, line.discountPercent ?? 0, String(lineTotal)],
    );
  }
  await c.query('UPDATE "Proposal" SET "totalAmount" = $1 WHERE id = $2', [String(proposalTotal), proposalId]);

  // 4. Contract (upsert by contractNo) + lines + signature + milestone obligations.
  const ctrRes = await c.query(
    `INSERT INTO "Contract" (id, "tenantId", "contractNo", "sourceOpportunityId", "customerId", status, "effectiveFrom", currency, "createdBy", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'seed', now())
     ON CONFLICT ("tenantId", "contractNo") DO UPDATE SET status = EXCLUDED.status, "updatedAt" = now()
     RETURNING id`,
    [tenantId, contract.contractNo, opportunityId, customerId, contract.status, contract.effectiveFrom, opportunity.currency],
  );
  const contractId = ctrRes.rows[0].id;

  const lineIdByCatalogCode = new Map();
  let contractTotal = 0;
  for (const line of contract.lines) {
    const catalogItemId = catalogIdByCode.get(line.catalogCode);
    contractTotal += Number(line.lineValue);
    const existing = await c.query('SELECT id FROM "ContractLine" WHERE "tenantId" = $1 AND "contractId" = $2 AND "catalogItemId" = $3', [tenantId, contractId, catalogItemId]);
    if (existing.rows.length > 0) {
      lineIdByCatalogCode.set(line.catalogCode, existing.rows[0].id);
      continue;
    }
    const lineRes = await c.query(
      `INSERT INTO "ContractLine" (id, "tenantId", "contractId", "catalogItemId", "deliveryMethod", "billingMethod", "lineValue", "acceptanceRequired", "projectTemplateCode")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [tenantId, contractId, catalogItemId, line.deliveryMethod, line.billingMethod, line.lineValue, !!line.acceptanceRequired, line.projectTemplateCode ?? null],
    );
    lineIdByCatalogCode.set(line.catalogCode, lineRes.rows[0].id);
  }
  await c.query('UPDATE "Contract" SET "totalAmount" = $1 WHERE id = $2', [String(contractTotal), contractId]);

  const sigExisting = await c.query('SELECT id FROM "ContractSignature" WHERE "tenantId" = $1 AND "contractId" = $2', [tenantId, contractId]);
  if (sigExisting.rows.length === 0) {
    await c.query(
      `INSERT INTO "ContractSignature" (id, "tenantId", "contractId", provider, "envelopeRef", "signerName", "createdBy")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'seed')`,
      [tenantId, contractId, contract.signature.provider, contract.signature.envelopeRef, contract.signature.signerName],
    );
  }

  const milestoneLineId = lineIdByCatalogCode.get('XOFFICE-IMP'); // milestones bill against the implementation line
  let readyBillingCreated = 0;
  for (const ms of contract.milestones) {
    const existing = await c.query('SELECT id, status FROM "ContractObligation" WHERE "tenantId" = $1 AND "contractId" = $2 AND title = $3', [tenantId, contractId, ms.title]);
    const dueDate = new Date(new Date(contract.effectiveFrom).getTime() + ms.dueOffsetDays * 24 * 60 * 60 * 1000);
    let obligationId;
    if (existing.rows.length > 0) {
      obligationId = existing.rows[0].id;
    } else {
      const obRes = await c.query(
        `INSERT INTO "ContractObligation" (id, "tenantId", "contractId", "contractLineId", type, title, "dueDate", "billingPercent", status)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'MILESTONE_BILLING', $4, $5, $6, 'PENDING')
         RETURNING id`,
        [tenantId, contractId, milestoneLineId, ms.title, dueDate, ms.billingPercent],
      );
      obligationId = obRes.rows[0].id;
    }
    if (ms.completed) {
      await c.query(
        `UPDATE "ContractObligation" SET status = 'COMPLETED', "evidenceRef" = $1, "completedAt" = now() WHERE id = $2 AND status != 'COMPLETED'`,
        [`seed: ${ms.title} nghiệm thu xong`, obligationId],
      );
      // Generate a matching, idempotent READY BillingRequest for the completed milestone.
      const idempotencyKey = `seed-billing-${contract.contractNo}-${ms.code}`;
      const billingExisting = await c.query('SELECT id FROM "BillingRequest" WHERE "tenantId" = $1 AND "idempotencyKey" = $2', [tenantId, idempotencyKey]);
      if (billingExisting.rows.length === 0) {
        const requestedAmount = (contractTotal * ms.billingPercent) / 100;
        await c.query(
          `INSERT INTO "BillingRequest" (id, "tenantId", "contractId", "contractLineId", status, "requestedAmount", currency, "idempotencyKey", "createdBy", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, 'READY', $4, $5, $6, 'seed', now())`,
          [tenantId, contractId, milestoneLineId, String(requestedAmount), opportunity.currency, idempotencyKey],
        );
        readyBillingCreated++;
      }
    }
  }

  await c.query('COMMIT');
  console.log(`revenue-contract-journey seed OK | opportunity=1 proposal=1 contract=1 catalogItems=${catalogItems.length} milestones=${contract.milestones.length} readyBillingCreated=${readyBillingCreated}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('revenue-contract-journey seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
