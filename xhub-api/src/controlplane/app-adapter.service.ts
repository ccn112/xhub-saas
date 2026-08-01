import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

/**
 * Input to the mock adapter for one provisioning attempt.
 */
export interface AdapterInput {
  tenantId: string;
  applicationCode: string;
  ownerSystem: string;
  action: string; // create_account | update_roles | suspend
  personId: string;
  email?: string | null;
  fullName?: string | null;
  appRoles: string[];
  attempt: number; // 1-based
  payload: Record<string, any>;
}

/**
 * Result the mock adapter returns to the outbox executor.
 */
export interface AdapterResult {
  externalAccountId: string;
  externalUsername: string | null;
  /** SourceReference pointer built from the adapter's REAL returned id. */
  sourceRef: {
    system: string;
    type: string;
    id: string;
    version: string;
  };
  raw: Record<string, any>;
}

export class AdapterConflictError extends Error {
  constructor(
    message: string,
    public readonly detail: Record<string, any>,
  ) {
    super(message);
    this.name = 'AdapterConflictError';
  }
}

/**
 * AppAdapterService — a MOCK application adapter. It NEVER creates a real
 * account in x1 / x2 / xweb (or any target). It simulates the target system's
 * provisioning API and returns a DETERMINISTIC externalAccountId derived from
 * (tenant, app, person). The SourceReference is built from that real returned
 * id (a pointer), never fabricated business data.
 *
 * Failure/conflict injection (for retry + conflict-center demos) is driven ONLY
 * by explicit flags on the command payload:
 *   - payload.__failUntilAttempt = N  → throw a transient error until attempt N.
 *   - payload.__simulateExisting = true → throw AdapterConflictError (the target
 *     reports the account already exists).
 * No hidden/implicit behavior; without these flags every attempt succeeds.
 */
@Injectable()
export class AppAdapterService {
  provision(input: AdapterInput): AdapterResult {
    // Deterministic external id from stable inputs (mock, reproducible).
    const shortHash = createHash('sha256')
      .update(`${input.tenantId}:${input.applicationCode}:${input.personId}`)
      .digest('hex')
      .slice(0, 10);
    const externalAccountId = `${input.applicationCode}-acct-${shortHash}`;

    // Conflict injection: target reports the account already exists.
    if (input.payload?.__simulateExisting === true) {
      throw new AdapterConflictError(
        `account already exists in ${input.applicationCode}`,
        {
          applicationCode: input.applicationCode,
          externalAccountId,
          personId: input.personId,
        },
      );
    }

    // Transient-failure injection: fail until the given attempt (retry demo).
    const failUntil = Number(input.payload?.__failUntilAttempt ?? 0);
    if (failUntil && input.attempt < failUntil) {
      throw new Error(
        `mock transient failure in ${input.applicationCode} (attempt ${input.attempt} < ${failUntil})`,
      );
    }

    const externalUsername =
      (input.email && input.email.split('@')[0]) || input.personId;

    return {
      externalAccountId,
      externalUsername,
      sourceRef: {
        system: input.ownerSystem,
        type: 'user',
        id: externalAccountId,
        version: new Date().toISOString(),
      },
      raw: {
        applicationCode: input.applicationCode,
        action: input.action,
        appRoles: input.appRoles,
        provisionedAt: new Date().toISOString(),
        mock: true,
      },
    };
  }
}
