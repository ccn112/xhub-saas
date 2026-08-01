"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Publish a DRAFT blueprint / seed pack. Posts to the platform catch-all proxy
// (forwarded with the canonical operator identity). A PUBLISHED (code,version)
// becomes immutable; the seed-pack publish additionally runs the secret guard
// server-side (rejected with 400 MUST_NOT_LEAK if any secret-like field exists).
export function PublishCatalogButton({
  kind,
  id,
  status,
}: {
  kind: "blueprints" | "seed-packs";
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "PUBLISHED") return null;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/${kind}/${id}/publish`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? `Lỗi ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={publish}
        disabled={busy}
        className="w-fit rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {busy ? "Đang xuất bản…" : "Xuất bản (publish)"}
      </button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </div>
  );
}
