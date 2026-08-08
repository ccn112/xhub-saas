// Task 23 verification — boots a minimal Nest application CONTEXT (no HTTP
// listener) with only the modules Task 23 touches (PrismaModule +
// OrganizationsModule + ProductsModule), then calls the real, compiled
// service methods against the live `xhub` DB. This deliberately avoids
// PlatformAppModule/AppModule, both of which currently fail to boot because
// of a pre-existing, unrelated environment problem: `@prisma/xoffice-client`
// was never generated in this environment, and regenerating it is currently
// blocked by an upstream bug in prisma@7.9.1's `@prisma/dev` (requires an
// ESM-only `zeptomatch@2.1.0` via CommonJS `require()` — crashes on load).
// Neither OrganizationsModule nor ProductsModule import anything XOffice-
// related, so this script exercises the ACTUAL Task 23 code paths (not a
// reimplementation) with zero dependency on that broken piece.
//
// Run from xhub-api/ after `npx nest build`: node scripts/verify-task23.mjs
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../dist/src/prisma/prisma.module.js';
import { OrganizationsModule } from '../dist/src/organizations/organizations.module.js';
import { OrganizationsService } from '../dist/src/organizations/organizations.service.js';
import { ProductsModule } from '../dist/src/products/products.module.js';
import { ProductsService } from '../dist/src/products/products.service.js';

// Plain .mjs has no decorator syntax — apply @Module's decorator as a plain
// function call instead (exactly what `@Module(...)` compiles down to).
class VerifyModule {}
Module({ imports: [PrismaModule, OrganizationsModule, ProductsModule] })(VerifyModule);

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(VerifyModule, { logger: false });
  const organizations = app.get(OrganizationsService);
  const products = app.get(ProductsService);

  console.log('\n== OrganizationsService ==');

  // 1. list() with the new researchStatus filter. NOTE: the 124 DATA-02
  // "DISCOVERED" rows were deliberately never promoted to Organization (they
  // stay in OrgSourceRecord only, per data02-baseline-seed.mjs's own rule —
  // "never promoted to canonical without evidence") — so DISCOVERED can never
  // appear here by design. That means the plan's original manual-test wording
  // ("researchStatus=DISCOVERED shows the unpromoted candidates") doesn't
  // apply to this endpoint as built; reviewing staged/DISCOVERED candidates
  // would need a separate endpoint over OrgSourceRecord (not built — out of
  // Wave A scope, flagging here rather than silently testing around it).
  // Verified against a real value instead: VERIFIED_SEED (18 rows, DATA-02's
  // hand-verified seed set).
  const seedVerified = await organizations.list({ researchStatus: 'VERIFIED_SEED', limit: 5 });
  assert(seedVerified.meta.total > 0, `researchStatus=VERIFIED_SEED returns rows (total=${seedVerified.meta.total})`);
  assert(
    seedVerified.items.every((o) => o.researchStatus === 'VERIFIED_SEED'),
    'every returned row actually has researchStatus=VERIFIED_SEED',
  );
  assert(
    'organizationType' in seedVerified.items[0] && 'displayImage' in seedVerified.items[0],
    'list() summary now exposes organizationType + displayImage',
  );

  // 2. list() with organizationType filter (DATA-03 manufacturers).
  const manufacturers = await organizations.list({ organizationType: 'MANUFACTURER_SERVICE', limit: 5 });
  console.log(`  (info) organizationType=MANUFACTURER_SERVICE total=${manufacturers.meta.total}`);

  // 3. getById() on a DATA-02/03 org that has serviceCapabilities + media —
  // find one via a raw list scan first (no separate query API for that yet).
  const withMedia = await organizations.list({ limit: 100 });
  const candidate = withMedia.items.find((o) => o.displayImage);
  assert(!!candidate, 'at least one Organization in the first 100 has a cached displayImage');
  const detail = await organizations.getById(candidate.id);
  assert(Array.isArray(detail.serviceCapabilities), 'getById() detail exposes serviceCapabilities array');
  assert(Array.isArray(detail.media) && detail.media.length > 0, 'getById() detail exposes non-empty media array');
  assert(
    detail.media.every((m) => m.url?.startsWith('/media/organizations/') && !m.url.includes('storage/media')),
    'media URLs are servable-style paths, never the raw server localMediaPath',
  );
  console.log(`  (evidence) org=${detail.legalName} media=${JSON.stringify(detail.media)}`);

  console.log('\n== ProductsService ==');

  const productList = await products.list({ limit: 5 });
  assert(productList.meta.total > 0, `products.list() returns rows (total=${productList.meta.total})`);
  const productDetail = await products.getById(productList.items[0].id);
  assert(!!productDetail.id, 'products.getById() returns the product');
  console.log(`  (evidence) product=${productDetail.familyName ?? productDetail.modelCode} manufacturer=${productDetail.manufacturer?.name}`);

  const specs = await products.getSpecs(productDetail.id);
  console.log(`  (info) specs count=${specs.items.length}`);

  const suppliers = await products.getSuppliers(productDetail.id);
  console.log(`  (info) suppliers/channel-relations count=${suppliers.items.length}`);

  const prices = await products.getPrices(productDetail.id);
  assert(
    prices.items.every((p) => typeof p.amount === 'number' && !!p.priceScope),
    'every price observation has amount + priceScope (never a bare static price)',
  );
  console.log(`  (info) price observations count=${prices.items.length}`);

  // 404 behavior — must throw, not silently return null.
  let threw = false;
  try {
    await products.getById('nonexistent-id-xyz');
  } catch (e) {
    threw = e?.constructor?.name === 'NotFoundException' || e?.status === 404;
  }
  assert(threw, 'products.getById() on unknown id throws NotFoundException (404), not silent null');

  console.log('\nVERIFY_TASK23_OK');
  await app.close();
}

main().catch((err) => {
  console.error('VERIFY_TASK23_FAILED', err);
  process.exitCode = 1;
});
