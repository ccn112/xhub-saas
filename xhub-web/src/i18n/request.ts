import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

// Cookie-based locale resolution — deliberately NOT using next-intl's
// prefix-based routing (no /vi or /en URL segments). Rationale: the app
// already has ~150 routes; prefixing every route would be a repo-wide
// structural rewrite. Reading a plain cookie keeps every existing URL/link
// unchanged while still giving every Server/Client Component access to
// translations via next-intl's standard hooks.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
