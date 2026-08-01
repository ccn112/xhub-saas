import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SeedService } from '../seed/seed.service';
import {
  DEFAULT_TENANT_ID,
  DEFAULT_USER_ID,
  RequestIdentity,
  SESSION_COOKIE,
  SessionJwtPayload,
} from './identity.types';
import { hashPassword, hashToken, newToken, verifyPassword } from './auth-crypto';

/** One-time token lifetimes (INTERNAL auth, PH-00b). */
const INVITE_TTL_MS = 1000 * 60 * 60 * 72; // 72h
const RESET_TTL_MS = 1000 * 60 * 30; // 30m (short)

export interface PendingInvite {
  personId: string;
  fullName?: string;
  email?: string;
  expiresAt: Date;
  createdBy: string;
  createdAt: Date;
}

export interface TokenGrant {
  token: string;
  activationUrl?: string;
  resetUrl?: string;
  expiresAt: Date;
  personId: string;
}

type SeedUser = {
  id: string;
  tenantId?: string;
  name?: string;
  email?: string;
  title?: string;
  avatar?: string;
  status?: string;
  primaryRole?: string;
};

export interface PublicUser {
  id: string;
  name?: string;
  email?: string;
  title?: string;
  avatar?: string;
  status?: string;
}

export interface MembershipView {
  tenantId: string;
  roles: string[];
  status: string;
}

export interface SessionResult {
  token: string;
  user: PublicUser;
  tenantId: string;
  roles: string[];
  memberships: MembershipView[];
}

/**
 * AuthService — dev login (passwordless) + session issuance and identity
 * resolution. Users come from the canonical seed (SeedService); memberships
 * live in Postgres (Membership). NO credential/secret is stored: real password
 * verification is delegated to the IdP.
 *
 * OIDC HOOK: for STANDALONE/FEDERATED modes, replace `login()` with the
 * authorization-code flow (passport-openidconnect): the IdP verifies the
 * credential and returns claims; we then load memberships and issue the same
 * `xhub_session` JWT below. Everything downstream (guard, /me, switch-tenant)
 * stays identical.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly seed: SeedService,
  ) {}

  /** Seed Membership from existing seed users if the table is empty (idempotent). */
  async onModuleInit(): Promise<void> {
    try {
      // Membership is the SHARED identity plane (spans tenants). Seeding + the
      // per-user membership lookups below legitimately cross tenants → bypass RLS.
      await this.prisma.withBypass(async () => {
        const count = await this.prisma.db.membership.count();
        if (count > 0) return;
        const users = this.allUsers();
        for (const u of users) {
          const tenantId = u.tenantId ?? DEFAULT_TENANT_ID;
          const roles = u.primaryRole ? [u.primaryRole] : [];
          await this.prisma.db.membership.upsert({
            where: { tenantId_userId: { tenantId, userId: u.id } },
            update: { roles, status: u.status === 'active' ? 'active' : 'active' },
            create: { tenantId, userId: u.id, roles, status: 'active' },
          });
        }
      });
    } catch {
      // DB not reachable at boot → skip; login synthesizes a default membership.
    }
  }

  private allUsers(): SeedUser[] {
    // Users only exist under the canonical tenant in the seed today.
    return this.seed.collection('users', this.seed.canonicalTenantId) as SeedUser[];
  }

  private toPublic(u: SeedUser): PublicUser {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      title: u.title,
      avatar: u.avatar,
      status: u.status,
    };
  }

  private findUser(identifier: string): SeedUser | undefined {
    const id = identifier.trim();
    const lower = id.toLowerCase();
    return this.allUsers().find(
      (u) => u.id === id || (u.email && u.email.toLowerCase() === lower),
    );
  }

  private async membershipsFor(user: SeedUser): Promise<MembershipView[]> {
    // Cross-tenant read (all of a user's memberships) → shared identity plane, bypass RLS.
    const rows = await this.prisma.withBypass(() =>
      this.prisma.db.membership.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      }),
    );
    if (rows.length > 0) {
      return rows.map((r) => ({ tenantId: r.tenantId, roles: r.roles, status: r.status }));
    }
    // Fallback (table not seeded / DB offline): synthesize one default membership.
    return [
      {
        tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
        roles: user.primaryRole ? [user.primaryRole] : [],
        status: 'active',
      },
    ];
  }

  private sign(userId: string, tenantId: string, roles: string[]): string {
    const payload: SessionJwtPayload = { sub: userId, tenant: tenantId, roles };
    return this.jwt.sign(payload);
  }

  /**
   * Login. Two ADDITIVE paths:
   *  - password given → verify the INTERNAL UserCredential hash (argon2). A
   *    credential-less account → 409 "chưa kích hoạt" (invite required).
   *  - no password → legacy DEV passwordless login against the seed collection
   *    (unchanged; header identity path in resolveIdentity is untouched).
   */
  async login(identifier: string, password?: string): Promise<SessionResult> {
    if (!identifier) throw new UnauthorizedException('Missing email or userId');
    if (password) return this.passwordLogin(identifier, password);
    const user = this.findUser(identifier);
    if (!user) throw new UnauthorizedException('Unknown user');
    const memberships = await this.membershipsFor(user);
    const active = memberships.find((m) => m.status === 'active') ?? memberships[0];
    if (!active) throw new UnauthorizedException('User has no active membership');
    const token = this.sign(user.id, active.tenantId, active.roles);
    return {
      token,
      user: this.toPublic(user),
      tenantId: active.tenantId,
      roles: active.roles,
      memberships,
    };
  }

  // ---- INTERNAL auth: password / invite / reset / suspend (PH-00b) ----------

  private webBase(): string {
    return process.env.AUTH_WEB_BASE ?? 'http://localhost:3000';
  }

  /** Resolve a DB-backed account (PersonProfile) by account id or email. */
  private async findPerson(identifier: string) {
    const id = identifier.trim();
    return this.prisma.withBypass(async () => {
      const byId = await this.prisma.db.personProfile.findUnique({ where: { id } });
      if (byId) return byId;
      return this.prisma.db.personProfile.findFirst({
        where: { email: { equals: id, mode: 'insensitive' } },
      });
    });
  }

  /** Best-effort audit row (never blocks the flow). */
  private async audit(
    tenantId: string,
    actorId: string,
    action: string,
    detail: string,
    subject?: string,
  ): Promise<void> {
    try {
      await this.prisma.withTenant(tenantId, () =>
        this.prisma.db.auditLog.create({
          data: { tenantId, actorId, instanceCode: subject ?? actorId, action, detail },
        }),
      );
    } catch {
      /* audit is best-effort */
    }
  }

  /** Build a signed session for a DB account (used by activate/password login). */
  private async buildSessionFor(userId: string, tenantId: string): Promise<SessionResult> {
    const memberships = await this.membershipsFor({ id: userId, tenantId } as SeedUser);
    const active =
      memberships.find((m) => m.tenantId === tenantId && m.status === 'active') ??
      memberships.find((m) => m.status === 'active') ??
      memberships[0];
    if (!active) throw new UnauthorizedException('User has no active membership');
    const person = await this.findPerson(userId);
    const publicUser: PublicUser = {
      id: userId,
      name: person?.fullName,
      email: person?.email ?? undefined,
      status: active.status,
    };
    const token = this.sign(userId, active.tenantId, active.roles);
    return { token, user: publicUser, tenantId: active.tenantId, roles: active.roles, memberships };
  }

  /** Verify an INTERNAL password credential (argon2). */
  private async passwordLogin(identifier: string, password: string): Promise<SessionResult> {
    const person = await this.findPerson(identifier);
    if (!person) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    const userId = person.id;
    const tenantId = person.tenantId;
    const cred = await this.prisma.withTenant(tenantId, () =>
      this.prisma.db.userCredential.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      }),
    );
    // No credential yet → account not activated (invite required).
    if (!cred) throw new ConflictException('Tài khoản chưa kích hoạt (cần lời mời)');
    if (!(await verifyPassword(cred.passwordHash, password))) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }
    // The membership for the account's HOME tenant must be active (a suspended
    // home membership blocks login even if the user holds other memberships).
    const memberships = await this.membershipsFor({ id: userId, tenantId } as SeedUser);
    const home = memberships.find((m) => m.tenantId === tenantId);
    if (!home || home.status !== 'active') {
      throw new UnauthorizedException('Tài khoản đang bị khoá');
    }
    return this.buildSessionFor(userId, tenantId);
  }

  /** Admin: create a single-use INVITE token (idempotent — supersedes prior ones). */
  async invite(actor: RequestIdentity, userId: string): Promise<TokenGrant> {
    const tenantId = actor.tenantId;
    const grant = await this.prisma.withTenant(tenantId, async () => {
      const person = await this.prisma.db.personProfile.findUnique({ where: { id: userId } });
      if (!person) throw new NotFoundException('Unknown account');
      const { raw, hash } = newToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      // Idempotent: retire prior outstanding invites for this person.
      await this.prisma.db.authToken.updateMany({
        where: { personId: person.id, kind: 'INVITE', usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.prisma.db.authToken.create({
        data: { tenantId, personId: person.id, kind: 'INVITE', tokenHash: hash, expiresAt, createdBy: actor.userId },
      });
      return { raw, expiresAt, personId: person.id };
    });
    await this.audit(tenantId, actor.userId, 'auth.invite', `invited ${grant.personId}`, grant.personId);
    return {
      token: grant.raw,
      activationUrl: `${this.webBase()}/activate?token=${grant.raw}`,
      expiresAt: grant.expiresAt,
      personId: grant.personId,
    };
  }

  /** Admin: outstanding (unused, unexpired) INVITE tokens for the tenant. */
  async pendingInvites(tenantId: string): Promise<PendingInvite[]> {
    return this.prisma.withTenant(tenantId, async () => {
      const rows = await this.prisma.db.authToken.findMany({
        where: { kind: 'INVITE', usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      const ids = [...new Set(rows.map((r) => r.personId))];
      const people = await this.prisma.db.personProfile.findMany({
        where: { id: { in: ids.length ? ids : ['__none__'] } },
      });
      const byId = new Map(people.map((p) => [p.id, p]));
      return rows.map((r) => ({
        personId: r.personId,
        fullName: byId.get(r.personId)?.fullName,
        email: byId.get(r.personId)?.email ?? undefined,
        expiresAt: r.expiresAt,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
      }));
    });
  }

  /** Look up + validate a raw one-time token (NEVER marks it used). */
  private async loadToken(rawToken: string, kind: 'INVITE' | 'RESET') {
    const hash = hashToken(rawToken);
    const token = await this.prisma.withBypass(() =>
      this.prisma.db.authToken.findFirst({ where: { tokenHash: hash, kind } }),
    );
    if (!token) throw new BadRequestException('Token không hợp lệ');
    if (token.usedAt) throw new BadRequestException('Token đã được sử dụng');
    if (token.expiresAt.getTime() < Date.now()) throw new BadRequestException('Token đã hết hạn');
    return token;
  }

  /** Activate an account: verify INVITE token → set password → membership active. */
  async activate(rawToken: string, password: string): Promise<SessionResult> {
    if (!rawToken || !password) throw new BadRequestException('Missing token or password');
    const token = await this.loadToken(rawToken, 'INVITE');
    const passwordHash = await hashPassword(password);
    const tenantId = token.tenantId;
    const userId = token.personId;
    await this.prisma.withTenant(tenantId, async () => {
      await this.prisma.db.userCredential.upsert({
        where: { tenantId_userId: { tenantId, userId } },
        update: { passwordHash, personId: userId },
        create: { tenantId, userId, personId: userId, passwordHash },
      });
      await this.prisma.db.membership.updateMany({ where: { userId, tenantId }, data: { status: 'active' } });
      await this.prisma.db.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    });
    await this.audit(tenantId, userId, 'auth.activate', `activated ${userId}`);
    return this.buildSessionFor(userId, tenantId);
  }

  /** Request a password reset → RESET token (surfaced, .local not emailed). */
  async forgot(identifier: string): Promise<TokenGrant | { ok: true }> {
    const person = await this.findPerson(identifier);
    // Do not reveal which accounts exist.
    if (!person) return { ok: true };
    const grant = await this.prisma.withTenant(person.tenantId, async () => {
      const { raw, hash } = newToken();
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);
      await this.prisma.db.authToken.updateMany({
        where: { personId: person.id, kind: 'RESET', usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.prisma.db.authToken.create({
        data: { tenantId: person.tenantId, personId: person.id, kind: 'RESET', tokenHash: hash, expiresAt, createdBy: person.id },
      });
      return { raw, expiresAt };
    });
    await this.audit(person.tenantId, person.id, 'auth.forgot', `reset requested ${person.id}`);
    return {
      token: grant.raw,
      resetUrl: `${this.webBase()}/reset?token=${grant.raw}`,
      expiresAt: grant.expiresAt,
      personId: person.id,
    };
  }

  /** Consume a RESET token → set a new password hash, invalidate the token. */
  async reset(rawToken: string, password: string): Promise<{ ok: true }> {
    if (!rawToken || !password) throw new BadRequestException('Missing token or password');
    const token = await this.loadToken(rawToken, 'RESET');
    const passwordHash = await hashPassword(password);
    const tenantId = token.tenantId;
    const userId = token.personId;
    await this.prisma.withTenant(tenantId, async () => {
      await this.prisma.db.userCredential.upsert({
        where: { tenantId_userId: { tenantId, userId } },
        update: { passwordHash, personId: userId },
        create: { tenantId, userId, personId: userId, passwordHash },
      });
      await this.prisma.db.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    });
    await this.audit(tenantId, userId, 'auth.reset', `password reset ${userId}`);
    return { ok: true };
  }

  /** Admin: suspend a membership → the user's next session request is revoked. */
  async suspend(actor: RequestIdentity, userId: string): Promise<{ ok: true; status: string }> {
    const tenantId = actor.tenantId;
    await this.prisma.withTenant(tenantId, () =>
      this.prisma.db.membership.updateMany({ where: { userId, tenantId }, data: { status: 'suspended' } }),
    );
    await this.audit(tenantId, actor.userId, 'auth.suspend', `suspended ${userId}`, userId);
    return { ok: true, status: 'suspended' };
  }

  /**
   * Session revoke-on-suspend check. When identity was resolved via the session
   * cookie, IdentityGuard calls this to re-check membership status (one indexed
   * query). Returns false → the guard 401s and clears the cookie. Fail-open for
   * dev personas without a membership row and when the DB is unreachable.
   */
  async sessionMembershipActive(userId: string, tenantId: string): Promise<boolean> {
    try {
      const m = await this.prisma.withBypass(() =>
        this.prisma.db.membership.findFirst({ where: { userId, tenantId } }),
      );
      if (!m) return true;
      return m.status === 'active';
    } catch {
      return true;
    }
  }

  /** Build the /me view from a resolved identity. */
  async me(identity: RequestIdentity): Promise<SessionResult & { source: string }> {
    const user = this.findUser(identity.userId) ?? {
      id: identity.userId,
      tenantId: identity.tenantId,
    };
    const memberships = await this.membershipsFor(user);
    const active =
      memberships.find((m) => m.tenantId === identity.tenantId) ??
      memberships[0] ?? { tenantId: identity.tenantId, roles: identity.roles, status: 'active' };
    return {
      token: '',
      user: this.toPublic(user),
      tenantId: identity.tenantId,
      roles: active.roles.length ? active.roles : identity.roles,
      memberships,
      source: identity.source,
    };
  }

  /** Switch active tenant — only if the user actually holds that membership. */
  async switchTenant(identity: RequestIdentity, tenantId: string): Promise<SessionResult> {
    const user = this.findUser(identity.userId);
    if (!user) throw new UnauthorizedException('Unknown user');
    const memberships = await this.membershipsFor(user);
    const target = memberships.find((m) => m.tenantId === tenantId && m.status === 'active');
    if (!target) throw new UnauthorizedException('No active membership for that tenant');
    const token = this.sign(user.id, target.tenantId, target.roles);
    return {
      token,
      user: this.toPublic(user),
      tenantId: target.tenantId,
      roles: target.roles,
      memberships,
    };
  }

  /**
   * Resolve request identity. Precedence: (a) JWT in `xhub_session` cookie →
   * (b) header x-user-id/x-tenant-id (kept for E2E + legacy FE) → (c) default demo.
   * Never throws — always returns something so the app keeps running.
   */
  resolveIdentity(
    req: {
      cookies?: Record<string, string>;
      headers: Record<string, unknown>;
    },
    opts?: { allowHeaderIdentity?: boolean },
  ): RequestIdentity {
    const cookieToken = req.cookies?.[SESSION_COOKIE];
    if (cookieToken) {
      try {
        const payload = this.jwt.verify<SessionJwtPayload>(cookieToken);
        return {
          userId: payload.sub,
          tenantId: payload.tenant,
          roles: payload.roles ?? [],
          source: 'session',
        };
      } catch {
        // invalid/expired token → fall through to header/default
      }
    }
    // Header/default identity is a DEV convenience. When disabled (production:
    // AUTH_ALLOW_HEADER_IDENTITY=false) and no valid session exists, resolve to
    // an ANONYMOUS identity — protected routes then return 401.
    const allowHeader = opts?.allowHeaderIdentity ?? true;
    if (!allowHeader) {
      return { userId: '', tenantId: '', roles: [], source: 'anonymous' };
    }
    const uid = req.headers['x-user-id'] as string | undefined;
    const tid = req.headers['x-tenant-id'] as string | undefined;
    if (uid || tid) {
      return {
        userId: uid || DEFAULT_USER_ID,
        tenantId: tid || DEFAULT_TENANT_ID,
        roles: [],
        source: 'header',
      };
    }
    return {
      userId: DEFAULT_USER_ID,
      tenantId: DEFAULT_TENANT_ID,
      roles: [],
      source: 'default',
    };
  }
}
