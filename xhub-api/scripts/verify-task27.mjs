// Task 27 verification — same pattern as verify-task23.mjs: boot a minimal
// Nest application context (PrismaModule + ProjectCatalogModule only, no
// XOffice dependency) and call the real, compiled getSupplyGraph() against
// the live DB. Run: node scripts/verify-task27.mjs
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../dist/src/prisma/prisma.module.js';
import { ProjectCatalogModule } from '../dist/src/project-catalog/project-catalog.module.js';
import { ProjectCatalogService } from '../dist/src/project-catalog/project-catalog.service.js';

class VerifyModule {}
Module({ imports: [PrismaModule, ProjectCatalogModule] })(VerifyModule);

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(VerifyModule, { logger: false });
  const catalog = app.get(ProjectCatalogService);

  const graph = await catalog.getSupplyGraph('BDS-PJ158'); // Hapulico's code
  assert(graph.projectId, 'getSupplyGraph resolves Hapulico by code');
  assert(graph.matchedCandidateCount === 0, `matchedCandidateCount=0 (correct — none of the 81 DATA-04 candidates is Hapulico, got ${graph.matchedCandidateCount})`);
  assert(Array.isArray(graph.edges) && graph.edges.length === 0, 'edges is an empty array, not null/undefined/error');
  assert(Array.isArray(graph.gaps) && graph.gaps.length === 0, 'gaps is an empty array, not null/undefined/error');
  assert(!!graph.note, 'empty-result note is present, explaining why (not a silent empty response)');
  console.log(`  (evidence) note="${graph.note}"`);

  let threw = false;
  try {
    await catalog.getSupplyGraph('does-not-exist');
  } catch (e) {
    threw = e?.constructor?.name === 'NotFoundException';
  }
  assert(threw, 'unknown project id throws NotFoundException (404), not silent empty');

  console.log('\nVERIFY_TASK27_OK');
  await app.close();
}

main().catch((err) => {
  console.error('VERIFY_TASK27_FAILED', err);
  process.exitCode = 1;
});
