import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NavigationMode = 'rail-context' | 'expanded';
export type ThemeMode = 'system' | 'light' | 'dark';
export type DensityMode = 'comfortable' | 'compact';

interface TenantDefault {
  tenantId: string;
  tenantCode: string;
  navigationMode: NavigationMode;
  allowedModes: NavigationMode[];
}
interface UserPref {
  tenantId: string;
  userId: string;
  navigationMode?: NavigationMode;
  theme?: ThemeMode;
  density?: DensityMode;
  sidebarCollapsed?: boolean;
}

const PLATFORM_DEFAULT: NavigationMode = 'rail-context';

export interface ResolvedPreference {
  tenantId: string;
  navigationMode: NavigationMode;
  tenantDefaultNavigationMode: NavigationMode;
  allowedNavigationModes: NavigationMode[];
  theme: ThemeMode;
  density: DensityMode;
  sidebarCollapsed?: boolean;
}

/**
 * Server-authoritative UI preferences. Precedence:
 * user-tenant preference > tenant default > platform default.
 * PATCH never trusts a client-supplied userId — the caller identity wins.
 */
@Injectable()
export class PreferencesService implements OnModuleInit {
  private tenantDefaults: TenantDefault[] = [];
  // In-memory overrides keyed by `${tenantId}::${userId}` (demo store).
  private overrides = new Map<string, UserPref>();

  onModuleInit() {
    const file = join(process.cwd(), 'seed-data', 'navigation-preferences.json');
    const data = JSON.parse(readFileSync(file, 'utf8')) as {
      tenantDefaults: TenantDefault[];
      userPreferences: UserPref[];
    };
    this.tenantDefaults = data.tenantDefaults ?? [];
    for (const p of data.userPreferences ?? []) {
      this.overrides.set(this.key(p.tenantId, p.userId), { ...p });
    }
  }

  private key(tenantId: string, userId: string) {
    return `${tenantId}::${userId}`;
  }

  private tenantDefault(tenantId: string): TenantDefault {
    return (
      this.tenantDefaults.find((t) => t.tenantId === tenantId) ?? {
        tenantId,
        tenantCode: tenantId,
        navigationMode: PLATFORM_DEFAULT,
        allowedModes: ['rail-context', 'expanded'],
      }
    );
  }

  resolve(tenantId: string, userId: string): ResolvedPreference {
    const td = this.tenantDefault(tenantId);
    const pref = this.overrides.get(this.key(tenantId, userId));
    return {
      tenantId,
      navigationMode: pref?.navigationMode ?? td.navigationMode ?? PLATFORM_DEFAULT,
      tenantDefaultNavigationMode: td.navigationMode ?? PLATFORM_DEFAULT,
      allowedNavigationModes: td.allowedModes ?? ['rail-context', 'expanded'],
      theme: pref?.theme ?? 'system',
      density: pref?.density ?? 'comfortable',
      sidebarCollapsed: pref?.sidebarCollapsed,
    };
  }

  patch(
    tenantId: string,
    userId: string,
    body: Partial<Pick<UserPref, 'navigationMode' | 'theme' | 'density' | 'sidebarCollapsed'>>,
  ): ResolvedPreference {
    const k = this.key(tenantId, userId);
    const cur = this.overrides.get(k) ?? { tenantId, userId };
    const allowed = this.tenantDefault(tenantId).allowedModes;
    const next: UserPref = { ...cur, tenantId, userId };
    if (body.navigationMode && allowed.includes(body.navigationMode)) next.navigationMode = body.navigationMode;
    if (body.theme) next.theme = body.theme;
    if (body.density) next.density = body.density;
    if (body.sidebarCollapsed !== undefined) next.sidebarCollapsed = body.sidebarCollapsed;
    this.overrides.set(k, next);
    return this.resolve(tenantId, userId);
  }
}
