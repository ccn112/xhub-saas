import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { getEngagement, stageLabel, formatValue, STATUS_TONES, LAUNCH_STATUS_TONES } from "@/xhub/delivery/delivery-data";
import { EngagementActions } from "@/xhub/delivery/EngagementActions";

export const dynamic = "force-dynamic";

export default async function EngagementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail } = await getEngagement(id);
  if (!detail) notFound();
  const { engagement: e, events, attachments, launch } = detail;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/delivery/engagements" className="text-sm text-primary-600 hover:underline dark:text-primary-400">← Danh sách dự án</Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">{e.customerName}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            {e.code} · {stageLabel(e.stage)} · phụ trách {e.ownerId} · {new Date(e.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <Badge tone={STATUS_TONES[e.status] ?? "neutral"}>{e.status}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* action bar */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-dark-100">Hành động vòng đời</h2>
            <EngagementActions
              id={e.id}
              legalActions={e.legalActions ?? []}
              launchReady={!!e.launchReady}
              onHold={!!e.onHold}
              hasLaunch={!!e.launchId}
            />
          </Card>

          {/* launch progress */}
          {launch ? (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Khởi chạy tenant khách</h2>
                <div className="flex items-center gap-2">
                  <Badge tone={LAUNCH_STATUS_TONES[launch.status] ?? "neutral"}>{launch.status}</Badge>
                  <Link href={`/platform/launches/${launch.id}`} className="text-xs text-primary-600 hover:underline dark:text-primary-400">Chi tiết →</Link>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">tenant đích: {launch.targetTenantId} · blueprint {launch.blueprintId ?? "—"} · seed {launch.seedPackId ?? "—"}</p>
              <ol className="mt-3 space-y-1">
                {[...(launch.steps ?? [])].sort((a, b) => a.seq - b.seq).map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-dark-200">{s.seq}. {s.stepKey}</span>
                    <Badge tone={s.status === "DONE" ? "success" : s.status === "FAILED" ? "error" : "neutral"}>{s.status}</Badge>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          {/* timeline */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-dark-100">Dòng thời gian</h2>
            <ol className="space-y-3">
              {events.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 dark:text-dark-100">{ev.type}</span>
                      <span className="text-xs text-gray-400">{new Date(ev.createdAt).toLocaleString("vi-VN")} · {ev.actorId}</span>
                    </div>
                    {Object.keys(ev.data ?? {}).length ? (
                      <pre className="mt-1 max-w-full overflow-x-auto rounded bg-gray-50 p-2 text-[11px] text-gray-500 dark:bg-dark-800 dark:text-dark-300">{JSON.stringify(ev.data)}</pre>
                    ) : null}
                  </div>
                </li>
              ))}
              {events.length === 0 ? <li className="text-sm text-gray-400">Chưa có sự kiện.</li> : null}
            </ol>
          </Card>
        </div>

        {/* sidebar: meta + attachments */}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-dark-100">Thông tin</h2>
            <dl className="space-y-2 text-sm">
              <Row k="Ngành" v={e.industry ?? "—"} />
              <Row k="Giá trị" v={formatValue(e.value)} />
              <Row k="Blueprint" v={e.blueprintCode ?? "—"} />
              <Row k="Seed pack" v={e.seedPackCode ?? "—"} />
              <Row k="Tenant đích" v={e.targetTenantId ?? "—"} />
              <Row k="tenantNo dự kiến" v={e.prospectTenantNo != null ? String(e.prospectTenantNo) : "—"} />
              <Row k="Launch" v={e.launchId ?? "chưa khởi chạy"} />
            </dl>
            {e.notes ? <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-dark-700 dark:text-dark-200">{e.notes}</p> : null}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-dark-100">Tài liệu đính kèm</h2>
            <ul className="space-y-2 text-sm">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span className="truncate text-gray-700 dark:text-dark-100">{a.title}</span>
                  <span className="text-xs text-gray-400">{a.kind}</span>
                </li>
              ))}
              {attachments.length === 0 ? <li className="text-gray-400">Chưa có tài liệu.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500 dark:text-dark-300">{k}</dt>
      <dd className="truncate text-right font-medium text-gray-800 dark:text-dark-50">{v}</dd>
    </div>
  );
}
