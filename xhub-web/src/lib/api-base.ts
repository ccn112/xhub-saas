// Single source of truth for the xhub-api backend base URL(s). Phase 1.5
// Stage A (2026-08-03) consolidated 3 duplicated env var names into one
// backend's server/client pair; Stage B (2026-08-04) split that pair in two,
// since xhub-api itself now runs as 2 separate processes — XHub Platform
// (control plane/master data/backup/webhook/launch-catalog-onboarding-
// lifecycle) and X.Office (workflow engine/requests/directives/tickets/
// bookings/announcements/records/work/manage/ioc/people/delivery). See
// docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5 Stage B.
//
// Server Components / Route Handlers: import the *_SERVER constant.
// Client Components ("use client"): import the *_CLIENT constant — Next.js
// only inlines env vars prefixed NEXT_PUBLIC_ into the browser bundle, so
// this must stay a separate literal reference (not derived from the server
// one).
export const PLATFORM_BASE_SERVER = process.env.XHUB_API_URL ?? "http://localhost:4000";
export const PLATFORM_BASE_CLIENT = process.env.NEXT_PUBLIC_XHUB_API_URL ?? "http://localhost:4000";
export const XOFFICE_BASE_SERVER = process.env.XOFFICE_API_URL ?? "http://localhost:4001";
export const XOFFICE_BASE_CLIENT = process.env.NEXT_PUBLIC_XOFFICE_API_URL ?? "http://localhost:4001";
