import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Regression test for the G0 finding (Audit260803, SEC-002/GAP-002): an
 * unprivileged user could grant themselves a delegation FROM an arbitrary
 * user (e.g. the platform admin) via `POST /api/xoffice/delegations` with no
 * permission check at all, then use it to act on that user's tasks via
 * `POST /api/xoffice/tasks/:id/act` — a live-proven privilege escalation.
 *
 * Both routes now carry `@RequirePermission`; granting a delegation on behalf
 * of someone else additionally requires `delegation.grant-any`
 * (xoffice.controller.ts `createDelegation`). This test proves the exploit
 * path is closed and that legitimate self-delegation still works.
 *
 * Uses the seeded demo users (user-nam = PLATFORM_ADMIN via
 * seed-data/identity/role-registry.seed.json, user-huyvu = no elevated role)
 * and the `x-authz-enforce` test-only header to prove enforcement without
 * requiring AUTH_ENFORCE=true globally — same technique as
 * scripts/authz-smoke.mjs.
 */
describe('X.Office delegation self-grant (e2e regression)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdDelegationIds: string[] = [];

  const ADMIN = { 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };
  const LOWPRIV = { 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-huyvu' };
  const ENFORCE = { 'x-authz-enforce': 'true' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    if (createdDelegationIds.length) {
      await prisma.withBypass(async () => {
        await prisma.db.delegation.deleteMany({ where: { id: { in: createdDelegationIds } } });
      });
    }
    await app.close();
  });

  it('denies an unprivileged user creating a delegation FROM another user (self-grant PoC)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/xoffice/delegations')
      .set({ ...LOWPRIV, ...ENFORCE })
      .send({
        fromUserId: 'user-nam',
        toUserId: 'user-huyvu',
        fromAt: new Date().toISOString(),
        toAt: new Date(Date.now() + 3_600_000).toISOString(),
        reason: 'e2e regression: must be denied',
      });
    expect([401, 403]).toContain(res.status);
  });

  it('denies an unprivileged, undelegated user acting on a task (the second half of the exploit)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/xoffice/tasks/nonexistent-task-id/act')
      .set({ ...LOWPRIV, ...ENFORCE })
      .send({ action: 'approve' });
    expect([401, 403]).toContain(res.status);
  });

  it('still allows a privileged user to delegate their OWN work away', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/xoffice/delegations')
      .set({ ...ADMIN, ...ENFORCE })
      .send({
        fromUserId: 'user-nam',
        toUserId: 'user-huyvu',
        fromAt: new Date().toISOString(),
        toAt: new Date(Date.now() + 3_600_000).toISOString(),
        reason: 'e2e regression: self-delegation stays allowed',
      });
    expect(res.status).toBeLessThan(300);
    if (res.body?.id) createdDelegationIds.push(res.body.id);
  });
});
