// FE logout — clears the httpOnly session cookie on the FE origin.
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/xhub/lib/session.server";

export async function POST() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
