import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import {
  AppAdapterService,
  AdapterConflictError,
} from './app-adapter.service';

interface BindInput {
  personId: string;
  applicationCode: string;
  idempotencyKey?: string;
  correlationId?: string;
  actorId: string;
  /** demo-only provisioning flags forwarded to the mock adapter. */
  payload?: Record<string, any>;
}

/**
 * ControlplaneService — Tenant Control Plane + Application Provisioning (S1–S2).
 *
 * Delegated provisioning: identity (PersonProfile) is the ONLY source of user
 * truth. An application holds a binding (pointer), never a master user.
 * Enabling an app / binding a person emits a ProvisioningCommand into an OUTBOX
 * that a MOCK adapter executes. Idempotency reuses the CommandLog pattern
 * (unique tenantId+idempotencyKey → replay). Conflicts (duplicate active
 * binding, or adapter "already exists") land in the conflict center.
 *
 * All tenant tables are RLS-protected. The seed spans tenants (xtech + the
 * demo-isolation canary) so it runs under withBypass and is idempotent.
 * ApplicationDefinition is the platform catalog (NOT tenant-scoped, no RLS).
 */
@Injectable()
export class ControlplaneService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly adapter: AppAdapterService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seed();
    } catch {
      // DB not reachable at boot → skip; endpoints degrade gracefully.
    }
  }

  // ---- seed (idempotent, deterministic, under RLS bypass) ------------------
  private async seed(): Promise<void> {
    const dir = join(process.cwd(), 'seed-data', 'controlplane');
    const catalog = JSON.parse(
      readFileSync(join(dir, 'application-catalog.json'), 'utf8'),
    );
    const XTECH = 'tenant-xtech';
    const DEMO = 'tenant-demo-isolation';
    const enabledForXtech = ['x1', 'x2', 'xweb'];

    await this.prisma.withBypass(async () => {
      // 1) Platform catalog (not tenant-scoped).
      for (const a of catalog.applications ?? []) {
        await this.prisma.db.applicationDefinition.upsert({
          where: { code: a.code },
          update: {
            name: a.name,
            ownerSystem: a.ownerSystem,
            provisioningMode: a.provisioningMode ?? 'MOCK',
            capabilities: a.capabilities ?? [],
            userSoR: a.userSoR ?? 'XHUB_IDENTITY_CORE',
            deepLink: a.deepLink ?? null,
            notes: a.notes ?? null,
          },
          create: {
            code: a.code,
            name: a.name,
            ownerSystem: a.ownerSystem,
            provisioningMode: a.provisioningMode ?? 'MOCK',
            capabilities: a.capabilities ?? [],
            userSoR: a.userSoR ?? 'XHUB_IDENTITY_CORE',
            deepLink: a.deepLink ?? null,
            notes: a.notes ?? null,
          },
        });
      }

      // 2) Enable x1/x2/xweb for tenant-xtech.
      for (const code of enabledForXtech) {
        await this.prisma.db.tenantApplicationInstance.upsert({
          where: { tenantId_applicationCode: { tenantId: XTECH, applicationCode: code } },
          update: { status: 'enabled' },
          create: { tenantId: XTECH, applicationCode: code, status: 'enabled', config: {} },
        });
      }

      // 3) Role mappings (immutable per version) for xtech.
      for (const rm of catalog.roleMappings ?? []) {
        await this.prisma.db.appRoleMapping.upsert({
          where: {
            tenantId_applicationCode_xhubRoleCode_version: {
              tenantId: XTECH,
              applicationCode: rm.applicationCode,
              xhubRoleCode: rm.xhubRoleCode,
              version: rm.version ?? 1,
            },
          },
          // version rows are immutable: only ensure existence.
          update: {},
          create: {
            tenantId: XTECH,
            applicationCode: rm.applicationCode,
            xhubRoleCode: rm.xhubRoleCode,
            appRole: rm.appRole,
            version: rm.version ?? 1,
          },
        });
      }

      // 4) Sample bindings for X-TECH people (pre-provisioned, deterministic).
      //    Uses the mock adapter output so externalAccountId/sourceRef are real
      //    (from the adapter), never fabricated. Idempotent by fixed ids.
      const samples = [
        { personId: 'usr-cfo', applicationCode: 'x1' },
        { personId: 'usr-admin-head', applicationCode: 'x2' },
      ];
      for (const s of samples) {
        const person = await this.prisma.db.personProfile.findUnique({ where: { id: s.personId } });
        if (!person) continue;
        const def = catalog.applications.find((a: any) => a.code === s.applicationCode);
        const res = this.adapter.provision({
          tenantId: XTECH,
          applicationCode: s.applicationCode,
          ownerSystem: def?.ownerSystem ?? 'MOCK',
          action: 'create_account',
          personId: s.personId,
          email: person.email,
          fullName: person.fullName,
          appRoles: [],
          attempt: 1,
          payload: {},
        });
        const cmdId = `seed-cmd-${XTECH}-${s.applicationCode}-${s.personId}`;
        const idempotencyKey = `seed:create_account:${s.applicationCode}:${s.personId}`;
        const existingCmd = await this.prisma.db.provisioningCommand.findUnique({ where: { id: cmdId } });
        if (!existingCmd) {
          await this.prisma.db.provisioningCommand.create({
            data: {
              id: cmdId,
              tenantId: XTECH,
              personId: s.personId,
              applicationCode: s.applicationCode,
              action: 'create_account',
              payload: {},
              status: 'completed',
              attempts: 1,
              correlationId: `seed-corr-${s.applicationCode}-${s.personId}`,
              idempotencyKey,
              result: res.raw as any,
              sourceRef: res.sourceRef as any,
            },
          });
        }
        await this.prisma.db.appAccountBinding.upsert({
          where: {
            tenantId_personId_applicationCode: {
              tenantId: XTECH,
              personId: s.personId,
              applicationCode: s.applicationCode,
            },
          },
          update: {
            status: 'active',
            externalAccountId: res.externalAccountId,
            externalUsername: res.externalUsername,
            sourceVersion: res.sourceRef.version,
            lastSyncedAt: new Date(),
          },
          create: {
            tenantId: XTECH,
            personId: s.personId,
            applicationCode: s.applicationCode,
            status: 'active',
            externalAccountId: res.externalAccountId,
            externalUsername: res.externalUsername,
            sourceVersion: res.sourceRef.version,
            lastSyncedAt: new Date(),
          },
        });
      }

      // 5) demo-isolation canary — rows in the new tables carrying a
      //    MUST_NOT_LEAK marker so the RLS test proves cross-tenant isolation.
      await this.prisma.db.tenantApplicationInstance.upsert({
        where: { tenantId_applicationCode: { tenantId: DEMO, applicationCode: 'x1' } },
        update: { status: 'enabled', config: { marker: 'MUST_NOT_LEAK' } },
        create: { tenantId: DEMO, applicationCode: 'x1', status: 'enabled', config: { marker: 'MUST_NOT_LEAK' } },
      });
      await this.prisma.db.appAccountBinding.upsert({
        where: {
          tenantId_personId_applicationCode: {
            tenantId: DEMO,
            personId: 'demo-person-canary',
            applicationCode: 'x1',
          },
        },
        update: { status: 'active', externalUsername: 'MUST_NOT_LEAK' },
        create: {
          tenantId: DEMO,
          personId: 'demo-person-canary',
          applicationCode: 'x1',
          status: 'active',
          externalAccountId: 'x1-acct-MUSTNOTLEAK',
          externalUsername: 'MUST_NOT_LEAK',
        },
      });
      const demoCmdId = 'seed-cmd-demo-canary';
      const demoCmd = await this.prisma.db.provisioningCommand.findUnique({ where: { id: demoCmdId } });
      if (!demoCmd) {
        await this.prisma.db.provisioningCommand.create({
          data: {
            id: demoCmdId,
            tenantId: DEMO,
            personId: 'demo-person-canary',
            applicationCode: 'x1',
            action: 'create_account',
            payload: { marker: 'MUST_NOT_LEAK' },
            status: 'completed',
            attempts: 1,
            correlationId: 'demo-corr-canary',
            idempotencyKey: 'seed:demo:canary',
            result: { marker: 'MUST_NOT_LEAK' } as any,
          },
        });
      }
    });
  }

  // ---- catalog (platform, not tenant-scoped) -------------------------------
  listApplications() {
    return this.prisma.db.applicationDefinition.findMany({ orderBy: { code: 'asc' } });
  }

  // ---- tenant applications -------------------------------------------------
  listTenantApplications(tenantId: string) {
    return this.prisma.db.tenantApplicationInstance.findMany({
      where: { tenantId },
      orderBy: { applicationCode: 'asc' },
    });
  }

  async setTenantApplication(
    tenantId: string,
    applicationCode: string,
    status: 'enabled' | 'disabled',
    config?: Record<string, any>,
  ) {
    const def = await this.prisma.db.applicationDefinition.findUnique({ where: { code: applicationCode } });
    if (!def) throw new NotFoundException(`unknown application: ${applicationCode}`);
    return this.prisma.db.tenantApplicationInstance.upsert({
      where: { tenantId_applicationCode: { tenantId, applicationCode } },
      update: { status, ...(config ? { config } : {}) },
      create: { tenantId, applicationCode, status, config: config ?? {} },
    });
  }

  // ---- role mappings -------------------------------------------------------
  listRoleMappings(tenantId: string, applicationCode?: string) {
    return this.prisma.db.appRoleMapping.findMany({
      where: { tenantId, ...(applicationCode ? { applicationCode } : {}) },
      orderBy: [{ applicationCode: 'asc' }, { xhubRoleCode: 'asc' }],
    });
  }

  /** Resolve a person's app roles + the mapping version in use for an app. */
  private async resolveAppRoles(
    tenantId: string,
    personId: string,
    applicationCode: string,
  ): Promise<{ appRoles: string[]; version: number | null }> {
    const roleEntries = await this.identity.roleCodesForPerson(personId);
    const roleCodes = new Set(roleEntries.map((r) => r.roleCode));
    const mappings = await this.prisma.db.appRoleMapping.findMany({
      where: { tenantId, applicationCode },
    });
    const appRoles: string[] = [];
    let version: number | null = null;
    for (const m of mappings) {
      if (roleCodes.has(m.xhubRoleCode)) {
        appRoles.push(m.appRole);
        version = version == null ? m.version : Math.max(version, m.version);
      }
    }
    return { appRoles: [...new Set(appRoles)], version };
  }

  // ---- bindings + provisioning outbox --------------------------------------
  listBindings(tenantId: string, applicationCode?: string) {
    return this.prisma.db.appAccountBinding.findMany({
      where: { tenantId, ...(applicationCode ? { applicationCode } : {}) },
      orderBy: [{ applicationCode: 'asc' }, { personId: 'asc' }],
    });
  }

  /**
   * Bind a person to an application and trigger provisioning through the outbox.
   *
   * Idempotency (CommandLog pattern): if a command with the same
   * (tenantId, idempotencyKey) exists, its stored result is replayed.
   * Business conflict: a NEW request (fresh key) for a person already ACTIVE on
   * the app is NOT a replay — it produces a `conflict` command + a
   * ProvisioningConflict row (the conflict center).
   */
  async createBinding(tenantId: string, input: BindInput) {
    const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
    const correlationId = input.correlationId?.trim() || randomUUID();

    // 1) Idempotent replay.
    const replay = await this.prisma.db.provisioningCommand.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    if (replay) {
      const binding = await this.prisma.db.appAccountBinding.findUnique({
        where: {
          tenantId_personId_applicationCode: {
            tenantId,
            personId: replay.personId,
            applicationCode: replay.applicationCode,
          },
        },
      });
      return { replayed: true, command: replay, binding };
    }

    // 2) App must be enabled for this tenant.
    const instance = await this.prisma.db.tenantApplicationInstance.findUnique({
      where: { tenantId_applicationCode: { tenantId, applicationCode: input.applicationCode } },
    });
    if (!instance || instance.status !== 'enabled') {
      throw new BadRequestException(
        `application ${input.applicationCode} is not enabled for this tenant`,
      );
    }

    // 3) Person must exist in the identity core (source of truth).
    const person = await this.prisma.db.personProfile.findUnique({ where: { id: input.personId } });
    if (!person) throw new NotFoundException(`unknown person: ${input.personId}`);

    const def = await this.prisma.db.applicationDefinition.findUnique({
      where: { code: input.applicationCode },
    });

    // 4) Duplicate active binding → conflict (not a replay).
    const existing = await this.prisma.db.appAccountBinding.findUnique({
      where: {
        tenantId_personId_applicationCode: {
          tenantId,
          personId: input.personId,
          applicationCode: input.applicationCode,
        },
      },
    });
    if (existing && existing.status === 'active') {
      const cmd = await this.prisma.db.provisioningCommand.create({
        data: {
          tenantId,
          personId: input.personId,
          applicationCode: input.applicationCode,
          action: 'create_account',
          payload: input.payload ?? {},
          status: 'conflict',
          attempts: 0,
          correlationId,
          idempotencyKey,
          error: 'binding already active',
        },
      });
      const conflict = await this.prisma.db.provisioningConflict.create({
        data: {
          tenantId,
          commandId: cmd.id,
          reason: 'account already exists (binding already active)',
          detail: {
            personId: input.personId,
            applicationCode: input.applicationCode,
            externalAccountId: existing.externalAccountId,
          },
        },
      });
      return { replayed: false, conflict: true, command: cmd, conflictRecord: conflict, binding: existing };
    }

    // 5) Fresh provisioning: pending binding + pending command, then execute.
    const { appRoles, version } = await this.resolveAppRoles(
      tenantId,
      input.personId,
      input.applicationCode,
    );

    const binding = await this.prisma.db.appAccountBinding.upsert({
      where: {
        tenantId_personId_applicationCode: {
          tenantId,
          personId: input.personId,
          applicationCode: input.applicationCode,
        },
      },
      update: { status: 'pending', roleMappingVersion: version },
      create: {
        tenantId,
        personId: input.personId,
        applicationCode: input.applicationCode,
        status: 'pending',
        roleMappingVersion: version,
      },
    });

    const command = await this.prisma.db.provisioningCommand.create({
      data: {
        tenantId,
        personId: input.personId,
        applicationCode: input.applicationCode,
        action: 'create_account',
        payload: { ...(input.payload ?? {}), appRoles },
        status: 'pending',
        attempts: 0,
        correlationId,
        idempotencyKey,
      },
    });

    const executed = await this.executeCommand(tenantId, command.id, {
      ownerSystem: def?.ownerSystem ?? 'MOCK',
      email: person.email,
      fullName: person.fullName,
      appRoles,
    });

    return { replayed: false, conflict: executed.status === 'conflict', command: executed, binding: executed.binding };
  }

  /**
   * Execute one outbox command via the mock adapter. Updates command +
   * binding + records conflicts. Returns the updated command (with `binding`).
   */
  private async executeCommand(
    tenantId: string,
    commandId: string,
    ctx: { ownerSystem: string; email?: string | null; fullName?: string | null; appRoles: string[] },
  ): Promise<any> {
    const cmd = await this.prisma.db.provisioningCommand.findUnique({ where: { id: commandId } });
    if (!cmd) throw new NotFoundException(`command not found: ${commandId}`);
    const attempt = cmd.attempts + 1;
    await this.prisma.db.provisioningCommand.update({
      where: { id: commandId },
      data: { status: 'sent', attempts: attempt },
    });

    try {
      const res = this.adapter.provision({
        tenantId,
        applicationCode: cmd.applicationCode,
        ownerSystem: ctx.ownerSystem,
        action: cmd.action,
        personId: cmd.personId,
        email: ctx.email,
        fullName: ctx.fullName,
        appRoles: ctx.appRoles,
        attempt,
        payload: (cmd.payload as any) ?? {},
      });

      const command = await this.prisma.db.provisioningCommand.update({
        where: { id: commandId },
        data: { status: 'completed', result: res.raw as any, sourceRef: res.sourceRef as any, error: null },
      });
      const binding = await this.prisma.db.appAccountBinding.update({
        where: {
          tenantId_personId_applicationCode: {
            tenantId,
            personId: cmd.personId,
            applicationCode: cmd.applicationCode,
          },
        },
        data: {
          status: 'active',
          externalAccountId: res.externalAccountId,
          externalUsername: res.externalUsername,
          sourceVersion: res.sourceRef.version,
          lastSyncedAt: new Date(),
        },
      });
      return { ...command, binding };
    } catch (err) {
      const isConflict = err instanceof AdapterConflictError;
      const status = isConflict ? 'conflict' : 'failed';
      const command = await this.prisma.db.provisioningCommand.update({
        where: { id: commandId },
        data: { status, error: (err as Error).message },
      });
      const binding = await this.prisma.db.appAccountBinding.update({
        where: {
          tenantId_personId_applicationCode: {
            tenantId,
            personId: cmd.personId,
            applicationCode: cmd.applicationCode,
          },
        },
        data: { status },
      });
      if (isConflict) {
        await this.prisma.db.provisioningConflict.create({
          data: {
            tenantId,
            commandId,
            reason: (err as Error).message,
            detail: (err as AdapterConflictError).detail as any,
          },
        });
      }
      return { ...command, binding };
    }
  }

  // ---- commands + retry ----------------------------------------------------
  listCommands(tenantId: string, status?: string) {
    return this.prisma.db.provisioningCommand.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retry a failed/conflict command. Re-runs the mock adapter. If the payload
   * carried a transient-failure flag, a later attempt can succeed (recovery).
   */
  async retryCommand(tenantId: string, commandId: string) {
    const cmd = await this.prisma.db.provisioningCommand.findUnique({ where: { id: commandId } });
    if (!cmd || cmd.tenantId !== tenantId) throw new NotFoundException(`command not found: ${commandId}`);
    if (cmd.status === 'completed') return { retried: false, reason: 'already completed', command: cmd };

    const person = await this.prisma.db.personProfile.findUnique({ where: { id: cmd.personId } });
    const def = await this.prisma.db.applicationDefinition.findUnique({ where: { code: cmd.applicationCode } });
    const { appRoles } = await this.resolveAppRoles(tenantId, cmd.personId, cmd.applicationCode);

    const command = await this.executeCommand(tenantId, commandId, {
      ownerSystem: def?.ownerSystem ?? 'MOCK',
      email: person?.email,
      fullName: person?.fullName,
      appRoles,
    });
    return { retried: true, command };
  }

  // ---- conflict center -----------------------------------------------------
  listConflicts(tenantId: string, resolved?: boolean) {
    return this.prisma.db.provisioningConflict.findMany({
      where: { tenantId, ...(resolved != null ? { resolved } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { command: true },
    });
  }

  // ---- reconciliation ------------------------------------------------------
  /**
   * Compare bindings vs commands and report drift (read-only). An active
   * binding should have a completed create_account command; a completed command
   * should have an active binding; open conflicts are surfaced.
   */
  async reconcile(tenantId: string) {
    const [bindings, commands, openConflicts] = await Promise.all([
      this.prisma.db.appAccountBinding.findMany({ where: { tenantId } }),
      this.prisma.db.provisioningCommand.findMany({ where: { tenantId } }),
      this.prisma.db.provisioningConflict.count({ where: { tenantId, resolved: false } }),
    ]);

    const completedKey = new Set(
      commands
        .filter((c) => c.status === 'completed' && c.action === 'create_account')
        .map((c) => `${c.personId}:${c.applicationCode}`),
    );
    const bindingKey = new Set(
      bindings
        .filter((b) => b.status === 'active')
        .map((b) => `${b.personId}:${b.applicationCode}`),
    );

    const issues: { type: string; personId: string; applicationCode: string }[] = [];
    for (const b of bindings) {
      if (b.status === 'active' && !completedKey.has(`${b.personId}:${b.applicationCode}`)) {
        issues.push({ type: 'active_binding_without_completed_command', personId: b.personId, applicationCode: b.applicationCode });
      }
    }
    for (const c of commands) {
      if (
        c.status === 'completed' &&
        c.action === 'create_account' &&
        !bindingKey.has(`${c.personId}:${c.applicationCode}`)
      ) {
        issues.push({ type: 'completed_command_without_active_binding', personId: c.personId, applicationCode: c.applicationCode });
      }
    }

    return {
      tenantId,
      bindings: bindings.length,
      commands: commands.length,
      openConflicts,
      consistent: issues.length === 0,
      issues,
    };
  }
}
