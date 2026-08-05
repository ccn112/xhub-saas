// FE proxy → xhub-api /api/revenue-kpi (Phase 2, BO-0209). Read-only, no sub-paths.
import { forwardGet } from "../_xoffice-forward";

export async function GET() {
  return forwardGet("/api/revenue-kpi");
}
