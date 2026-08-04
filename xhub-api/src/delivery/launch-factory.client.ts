import { Injectable, InternalServerErrorException } from '@nestjs/common';

/**
 * HTTP client for the Launch Factory (`/api/platform/launches`, XHUB_PLATFORM).
 * Replaces the old in-process `TenantLaunchService` injection (Phase 1.5 Stage
 * B — Delivery and the platform's launch module now run as separate
 * processes). Forwards the ACTING caller's tenant/user identity so the target
 * route's own `@RequirePermission('platform.launch.read'|'platform.launch.manage')`
 * guard evaluates for real (the old in-process call bypassed it entirely) —
 * see docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5 Stage B.
 */
@Injectable()
export class LaunchFactoryClient {
  private readonly base = process.env.PLATFORM_API_URL ?? 'http://localhost:4000';

  private headers(tenantId: string, actorId: string) {
    return { 'content-type': 'application/json', 'x-tenant-id': tenantId, 'x-user-id': actorId };
  }

  private async request(path: string, method: string, tenantId: string, actorId: string, body?: unknown) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers(tenantId, actorId),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new InternalServerErrorException(`launch factory request failed (${res.status}): ${JSON.stringify(data)}`);
    }
    return data;
  }

  detail(tenantId: string, actorId: string, launchId: string) {
    return this.request(`/api/platform/launches/${launchId}`, 'GET', tenantId, actorId);
  }

  create(tenantId: string, actorId: string, input: Record<string, unknown>) {
    return this.request('/api/platform/launches', 'POST', tenantId, actorId, input);
  }

  run(tenantId: string, actorId: string, launchId: string) {
    return this.request(`/api/platform/launches/${launchId}/run`, 'POST', tenantId, actorId);
  }
}
