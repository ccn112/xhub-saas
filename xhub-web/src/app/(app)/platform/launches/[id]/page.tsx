import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { getLaunch, LAUNCH_STATUS_TONES, STEP_STATUS_TONES, STEP_LABELS } from "@/xhub/platform/platform-data";
import { LaunchRunActions } from "@/xhub/platform/LaunchRunActions";

export const dynamic = "force-dynamic";

export default async function LaunchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { launch } = await getLaunch(id);
  if (!launch) notFound();

  const steps = [...(launch.steps ?? [])].sort((a, b) => a.seq - b.seq);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/platform/launches" className="text-sm text-primary-600 hover:underline dark:text-primary-400">← Danh sách launch</Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">
            Launch · {launch.targetTenantId}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            {launch.id} · tạo bởi {launch.createdBy ?? "—"} · {new Date(launch.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={LAUNCH_STATUS_TONES[launch.status] ?? "neutral"}>{launch.status}</Badge>
          <LaunchRunActions id={launch.id} status={launch.status} />
        </div>
      </div>

      <Card className="p-0">
        <ol className="divide-y divide-gray-100 dark:divide-dark-700">
          {steps.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 dark:text-dark-50">{STEP_LABELS[s.stepKey] ?? s.stepKey}</span>
                  <Badge tone={STEP_STATUS_TONES[s.status] ?? "neutral"}>{s.status}</Badge>
                  <span className="text-xs text-gray-400">attempts: {s.attempts}</span>
                </div>
                {s.error ? <p className="mt-1 text-xs text-error">{s.error}</p> : null}
                {s.result != null && s.status === "DONE" ? (
                  <pre className="mt-1 max-w-full overflow-x-auto rounded bg-gray-50 p-2 text-[11px] text-gray-600 dark:bg-dark-800 dark:text-dark-200">
                    {JSON.stringify(s.result, null, 2)}
                  </pre>
                ) : null}
              </div>
              <span className="whitespace-nowrap text-xs text-gray-400">
                {s.finishedAt ? new Date(s.finishedAt).toLocaleTimeString("vi-VN") : s.startedAt ? "đang chạy…" : ""}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
