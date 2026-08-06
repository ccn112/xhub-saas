// Single source of truth for supported locales. Vietnamese is the only
// locale with real, complete copy today — English exists to prove the
// switching mechanism works end-to-end (see docs/design-system section on
// i18n) and covers nav + home/executive + the Kinh doanh (Revenue & Contract)
// cluster converted this round. Everything else still renders Vietnamese
// literals regardless of the selected locale until converted.
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";

export const LOCALE_LABELS: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};
