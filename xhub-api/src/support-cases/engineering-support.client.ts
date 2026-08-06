import { Injectable, InternalServerErrorException } from '@nestjs/common';

/**
 * HTTP client for the Engineering Governance Hub's Product/Backlog/Defect
 * routes (`/api/engineering/*`, XHUB_PLATFORM, :4000). Used ONLY by the
 * SupportCase escalate action — SupportCase lives in the X.Office DB/process,
 * BacklogItem/Defect live in the Platform DB/process, so this is a real
 * cross-process call, same pattern as `src/delivery/launch-factory.client.ts`
 * (Delivery→Launch). Forwards the acting caller's tenant/user identity via
 * headers so the target routes' own @RequirePermission guards evaluate for
 * real — no in-process bypass.
 */
@Injectable()
export class EngineeringSupportClient {
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
      const err: any = new InternalServerErrorException(`engineering hub request failed (${res.status}): ${JSON.stringify(data)}`);
      err.upstreamStatus = res.status;
      throw err;
    }
    return data;
  }

  /**
   * Look up a Product by its code (e.g. "PRD-X2"). Returns null when the
   * Platform process itself returns 404 (unknown product) — the caller
   * (SupportCasesService.escalate) turns that into its own clean
   * NotFoundException instead of a confusing 500, which is what a generic
   * non-2xx→throw would otherwise produce for this specific, expected case.
   */
  async findProductByCode(tenantId: string, actorId: string, code: string) {
    try {
      return await this.request(`/api/engineering/products/${encodeURIComponent(code)}`, 'GET', tenantId, actorId);
    } catch (e: any) {
      if (e?.upstreamStatus === 404) return null;
      throw e;
    }
  }

  createBacklogItem(
    tenantId: string,
    actorId: string,
    input: {
      productId: string;
      title: string;
      description?: string;
      type?: string;
      priority?: string;
      sourceSystem: string;
      sourceRef: string;
      correlationId: string;
    },
  ) {
    return this.request('/api/engineering/backlog', 'POST', tenantId, actorId, input);
  }

  createDefect(
    tenantId: string,
    actorId: string,
    input: {
      productId: string;
      title: string;
      description?: string;
      severity?: string;
      sourceSystem: string;
      sourceRef: string;
      correlationId: string;
    },
  ) {
    return this.request('/api/engineering/defects', 'POST', tenantId, actorId, input);
  }
}
