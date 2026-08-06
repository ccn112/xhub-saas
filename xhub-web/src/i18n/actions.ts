"use server";

import { cookies } from "next/headers";
import { LOCALES, type Locale } from "./locales";

/** Server Action — sets the NEXT_LOCALE cookie. Client calls this then
 * router.refresh()es so every Server Component re-renders with the new
 * locale's messages (no full page reload, no URL change). */
export async function setLocale(locale: Locale): Promise<void> {
  if (!LOCALES.includes(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
