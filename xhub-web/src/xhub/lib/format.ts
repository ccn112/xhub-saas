// Deterministic formatters. NEVER use Date.now(); the "now" is the seed snapshot.
import { SEED_META } from "./seed";

export const NOW = SEED_META.snapshotAt; // fixed demo clock
const LOCALE = SEED_META.locale || "vi-VN";

export function vnd(value: number | undefined | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

/** Compact VND, e.g. 18,6 tỷ / 6,2 tỷ / 850 tr. */
export function vndShort(value: number | undefined | null): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} tỷ`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 0 })} tr`;
  return value.toLocaleString(LOCALE);
}

export function num(value: number | undefined | null): string {
  if (value == null) return "—";
  return value.toLocaleString(LOCALE);
}

export function dateVN(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function timeVN(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function dateTimeVN(iso: string | undefined | null): string {
  if (!iso) return "—";
  return `${dateVN(iso)} ${timeVN(iso)}`;
}
