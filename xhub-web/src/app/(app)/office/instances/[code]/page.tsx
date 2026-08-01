import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge, type Tone } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { getInstanceDetail } from "@/xoffice/lib/monitor-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Instance ${decodeURIComponent(code)} · X.Office` };
}

const statusTone: Record<string, Tone> = {
  running: "info", completed: "success", rejected: "error", cancelled: "neutral",
  open: "warning", pending: "warning", done: "success",
};

function fmtTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default async function InstanceDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);
  const { instance, tasks, audit, commands, externals, source } = await getInstanceDetail(code);

  if (!instance && source === "api") notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Link href="/office/instances" className="hover:text-primary-600">Vận hành</Link>
            <span>/</span>
            <span className="font-mono">{code}</span>
          </div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">
            {instance?.title ?? code}
          </h1>
        </div>
        {instance ? <Badge tone={statusTone[instance.status] ?? "neutral"}>{instance.status}</Badge> : null}
      </div>

      {!instance ? (
        <SectionCard title="Không có dữ liệu" accent="warning">
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Không tải được instance <span className="font-mono">{code}</span> (backend offline hoặc chưa tồn tại).
          </p>
        </SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Quy trình" value={instance.workflowCode} icon="🗂️" tone="primary" />
            <StatCard label="Task" value={String(tasks.length)} icon="✅" tone="warning" />
            <StatCard label="Lệnh connector" value={String(commands.length)} icon="🔌" tone="info" />
            <StatCard label="External action" value={String(externals.length)} icon="🌐" tone="neutral" />
          </div>

          <SectionCard title="Thông tin instance">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm md:grid-cols-2">
              <Row label="Mã instance" value={<span className="font-mono">{instance.instanceCode}</span>} />
              <Row label="Node hiện tại" value={`${instance.currentNodeName ?? instance.currentNodeId ?? "—"}${instance.currentNodeType ? ` (${instance.currentNodeType})` : ""}`} />
              <Row label="Người yêu cầu" value={instance.requesterEmail} />
              <Row label="SLA (giờ)" value={instance.slaHours != null ? String(instance.slaHours) : "—"} />
              <Row label="Tạo lúc" value={fmtTime(instance.createdAt)} />
              <Row label="Cập nhật" value={fmtTime(instance.updatedAt)} />
            </dl>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={`Task (${tasks.length})`} accent="warning">
              <div className="space-y-3">
                {tasks.map((t) => (
                  <div key={t.id} className="rounded-xl border border-gray-200 p-3 dark:border-dark-600">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-dark-100">{t.nodeName}</p>
                        <p className="font-mono text-xs text-gray-400">{t.id}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-300">
                          Vai trò: {t.assigneeRole}{t.slaHours ? ` · SLA ${t.slaHours}h` : ""}
                        </p>
                      </div>
                      <Badge tone={statusTone[t.status] ?? "neutral"}>{t.status}</Badge>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Không có task cho instance này.</p> : null}
              </div>
            </SectionCard>

            <SectionCard title="Timeline audit (append-only)" accent="info">
              <ol className="space-y-3">
                {audit.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                      <span className="mt-1 w-px flex-1 bg-gray-200 dark:bg-dark-600" />
                    </div>
                    <div className="pb-1">
                      <p className="text-sm text-gray-700 dark:text-dark-100">{a.detail}</p>
                      <p className="text-xs text-gray-400">{a.action} · {a.actorId} · {fmtTime(a.at)}</p>
                    </div>
                  </li>
                ))}
                {audit.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Chưa có bản ghi audit.</p> : null}
              </ol>
            </SectionCard>
          </div>

          <SectionCard title={`External executions (${externals.length})`} accent="neutral" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-400 dark:border-dark-600 dark:text-dark-300">
                  <tr>
                    <th className="px-4 py-3">Connector / Action</th>
                    <th className="px-4 py-3 text-center">Mode</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3">Mã tham chiếu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {externals.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/40">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-gray-700 dark:text-dark-100">{e.connectorCode}</p>
                        <p className="font-mono text-xs text-gray-400">{e.actionCode}</p>
                      </td>
                      <td className="px-4 py-3 text-center"><Badge tone="neutral">{e.mode}</Badge></td>
                      <td className="px-4 py-3 text-center"><Badge tone={statusTone[e.status] ?? "neutral"}>{e.status}</Badge></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-dark-200">
                        {e.referenceCode ? `${e.referenceCode}${e.referenceSystem ? ` (${e.referenceSystem})` : ""}` : "—"}
                      </td>
                    </tr>
                  ))}
                  {externals.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Không có external action.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0 dark:border-dark-600/50">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-700 dark:text-dark-100">{value}</dd>
    </div>
  );
}
