// Single source of truth for the xhub-api backend base URL. Before the
// 2026-08-03 boundary cleanup this same fallback ("http://localhost:4000")
// was duplicated across ~48 files under 3 different env var names —
// XHUB_API_URL (server), NEXT_PUBLIC_XHUB_API_URL (client), and an
// XOFFICE_API_BASE that was never declared in .env.example and so always
// silently resolved to localhost even when a real backend URL was
// configured. See docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md
// Phase 1.5 Stage A.
//
// Server Components / Route Handlers: import API_BASE_SERVER.
// Client Components ("use client"): import API_BASE_CLIENT — Next.js only
// inlines env vars prefixed NEXT_PUBLIC_ into the browser bundle, so this
// must stay a separate literal reference (not derived from the server one).
export const API_BASE_SERVER = process.env.XHUB_API_URL ?? "http://localhost:4000";
export const API_BASE_CLIENT = process.env.NEXT_PUBLIC_XHUB_API_URL ?? "http://localhost:4000";
