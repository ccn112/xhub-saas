import { Body, Controller, Get, Patch } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import type { NavigationMode, ThemeMode, DensityMode } from './preferences.service';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

interface PatchBody {
  navigationMode?: NavigationMode;
  theme?: ThemeMode;
  density?: DensityMode;
  sidebarCollapsed?: boolean;
  // NOTE: any userId/tenantId in the body is ignored on purpose.
}

/**
 * GET/PATCH /api/me/ui-preferences.
 * Identity comes from `req.identity` (IdentityGuard): session JWT → header
 * fallback → default demo. The client can NEVER set another user's preference.
 */
@Controller('api/me/ui-preferences')
export class PreferencesController {
  constructor(private readonly prefs: PreferencesService) {}

  @Get()
  get(@Identity() id: RequestIdentity) {
    return this.prefs.resolve(id.tenantId, id.userId);
  }

  @Patch()
  patch(@Body() body: PatchBody, @Identity() id: RequestIdentity) {
    return this.prefs.patch(id.tenantId, id.userId, {
      navigationMode: body.navigationMode,
      theme: body.theme,
      density: body.density,
      sidebarCollapsed: body.sidebarCollapsed,
    });
  }
}
