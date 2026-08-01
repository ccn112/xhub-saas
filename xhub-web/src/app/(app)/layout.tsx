import { ReactNode } from "react";
import { cookies } from "next/headers";

import { Providers } from "./providers";
import { getWorkspaceContext } from "@/xhub/lib/workspace";
import { getSession } from "@/xhub/lib/session.server";
import { XHUB_NAVIGATION } from "@/xhub/nav/navigation.model";
import { filterNavigation } from "@/xhub/nav/permissions";
import { filterNavByPermissions } from "@/xhub/nav/filter-by-permissions";
import { resolveBadges } from "@/xhub/nav/badges";
import { fetchUiPreferences } from "@/xhub/nav/preferences.server";
import { fetchNavPermissions } from "@/xhub/nav/nav-permissions.server";

// Server component: resolve the actor, read the server-authoritative UI
// preference, and hand the shell its initial navigation mode so first paint is
// already correct (no flash, no hydration mismatch).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { tenantId: defaultTenantId, actor } = getWorkspaceContext();

  // Real identity: if a valid `xhub_session` cookie is present, the actor +
  // tenant come from the authenticated session. Otherwise keep the demo default
  // actor so the app stays fully usable logged-out (backward-compat).
  const session = await getSession();

  // Demo hook: allow impersonating another actor via cookie for verification
  // (e.g. `xhub_actor=user-tran-thu-ha`). Session wins over the impersonation
  // cookie, which wins over the default actor.
  const cookieStore = await cookies();
  const actorId = session?.userId ?? cookieStore.get("xhub_actor")?.value ?? actor.id;
  const tenantId = session?.tenantId ?? defaultTenantId;

  const prefs = await fetchUiPreferences(actorId, tenantId);
  const navPerms = await fetchNavPermissions(actorId, tenantId);

  // Two-stage filter, both server-authoritative so every renderer receives the
  // same already-filtered tree:
  //   1. Legacy entitlement/permission-set filter (demo grants everything;
  //      unmapped items are already absent from the model).
  //   2. PH-01 / NX-016 role-visibility filter. DEFAULT-SAFE: `enforce` mirrors
  //      the backend gate (menuEnforce). When enforcement is OFF (dev default),
  //      the permission fetch failed, or the caller holds `*`, filterNavByPermissions
  //      returns the FULL tree — no regression, admin/dev sees everything.
  const tree = filterNavByPermissions(
    filterNavigation(XHUB_NAVIGATION),
    navPerms.permissions,
    { enforce: navPerms.ok && navPerms.menuEnforce },
  );
  const badges = resolveBadges(tenantId);

  const displayName = session?.user.name ?? (actor as { name?: string }).name;
  const displayTitle = session?.user.title ?? (actor as { title?: string }).title;

  return (
    <Providers
      identity={{
        userId: actorId,
        tenantId,
        name: displayName,
        title: displayTitle,
        authenticated: !!session,
      }}
      tree={tree}
      badges={badges}
      initialMode={prefs.navigationMode}
      tenantDefaultMode={prefs.tenantDefaultNavigationMode}
      allowedModes={prefs.allowedNavigationModes}
      initialDensity={prefs.density}
    >
      {children}
    </Providers>
  );
}
