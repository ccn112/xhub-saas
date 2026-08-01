// POST /api/admin/backup → forwards to xhub-api POST /api/backup (create backup).
import { forwardPost } from "../_forward";

export async function POST() {
  return forwardPost("/api/backup", {});
}
