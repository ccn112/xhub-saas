import { ForbiddenException, Injectable } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { IdentityService } from '../identity/identity.service';

/**
 * Team availability — roster (Position.holderPersonId) × overlapping
 * LeaveRequest in [from, to]. Read-only projection; no new SoR. Scope-checked
 * the same way LeaveService.listTeam is (reuse DataScope, no second ABAC).
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: XofficePrismaService,
    private readonly identity: IdentityService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  async team(tenantId: string, userId: string, orgUnitId: string, from?: string, to?: string) {
    const eff = await this.identity.effectivePermissions(userId);
    const scopedOrgUnits = [...new Set(eff.scopes.flatMap((s: any) => s?.orgUnits ?? []))];
    if (scopedOrgUnits.length && !scopedOrgUnits.includes(orgUnitId)) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'orgUnitId is outside caller scope' });
    }
    const fromAt = from ? new Date(from) : new Date();
    const toAt = to ? new Date(to) : new Date(fromAt.getTime() + 13 * 24 * 60 * 60 * 1000);

    const positions = await this.db.position.findMany({ where: { tenantId, orgUnitId } });
    const personIds = positions.map((p: any) => p.holderPersonId).filter((id: any): id is string => !!id);
    const people = personIds.length
      ? await this.db.personProfile.findMany({ where: { tenantId, id: { in: personIds } } })
      : [];
    const leaves = personIds.length
      ? await this.db.leaveRequest.findMany({
          where: {
            tenantId,
            personId: { in: personIds },
            status: { in: ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'CANCEL_REQUESTED'] },
            startAt: { lte: toAt },
            endAt: { gte: fromAt },
          },
        })
      : [];
    const byPerson = new Map<string, any[]>();
    for (const l of leaves as any[]) {
      if (!byPerson.has(l.personId)) byPerson.set(l.personId, []);
      byPerson.get(l.personId)!.push(l);
    }
    const roster = positions
      .filter((p: any) => p.holderPersonId)
      .map((p: any) => {
        const person = people.find((pp: any) => pp.id === p.holderPersonId);
        return {
          positionId: p.id,
          positionTitle: p.title,
          personId: p.holderPersonId,
          fullName: person?.fullName ?? p.holderPersonId,
          leaves: byPerson.get(p.holderPersonId) ?? [],
        };
      });
    return { orgUnitId, from: fromAt, to: toAt, roster, count: roster.length };
  }
}
