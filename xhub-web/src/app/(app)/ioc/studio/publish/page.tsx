import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listScenes, listPlans, listDashboards, getScene, getPlan, getDashboard, type VersionRow } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Rà soát & xuất bản · XHub IOC" };
export const dynamic = "force-dynamic";

function VersionTable({ versions }: { versions: VersionRow[] }) {
  if (!versions.length) return <p className="text-sm text-gray-400">Chưa xuất bản phiên bản nào.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-400 dark:border-dark-600">
            <th className="py-1.5 font-medium">Phiên bản</th>
            <th className="py-1.5 font-medium">Trạng thái</th>
            <th className="py-1.5 font-medium">Checksum</th>
            <th className="py-1.5 font-medium">Xuất bản</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
              <td className="py-1.5 font-medium text-gray-800 dark:text-dark-50">v{v.versionNo}</td>
              <td className="py-1.5"><Badge tone={v.status === "PUBLISHED" ? "success" : "neutral"}>{v.status}</Badge></td>
              <td className="py-1.5"><code className="text-[11px] text-gray-400">{v.checksum.slice(0, 16)}…</code></td>
              <td className="py-1.5 text-xs text-gray-500 dark:text-dark-300">{new Date(v.publishedAt).toLocaleString("vi-VN")} · {v.publishedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// IOC-S08 — Review & Publish (DT-01). Version history + checksum evidence for
// every plan, scene and dashboard. Published versions are IMMUTABLE: editing
// creates a new draft/version; rollback re-activates an older one and deletes
// nothing (Constitution #5, AT-002/AT-003).
export default async function PublishPage() {
  const [scenes, plans, dashboards] = await Promise.all([listScenes(), listPlans(), listDashboards()]);
  const [planDetails, sceneDetails, dashDetails] = await Promise.all([
    Promise.all(plans.items.map((p) => getPlan(p.id))),
    Promise.all(scenes.items.map((s) => getScene(s.id))),
    Promise.all(dashboards.items.map((d) => getDashboard(d.id))),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Rà soát & xuất bản</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Mỗi phiên bản đã xuất bản là bất biến và có checksum SHA-256. Sửa tạo phiên bản mới; rollback không xoá lịch sử.
          </p>
        </div>
        <Link href="/ioc/studio" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium dark:border-dark-500 dark:text-dark-100">Về Twin Studio</Link>
      </div>

      {planDetails.filter(Boolean).map((p) => (
        <SectionCard key={p!.id} title={`Mặt bằng · ${p!.name}`} accent="info" action={<Badge tone={p!.status === "PUBLISHED" ? "success" : "neutral"}>{p!.status === "PUBLISHED" ? `đang phục vụ v${p!.activeVersionNo}` : p!.status}</Badge>}>
          <VersionTable versions={p!.versions ?? []} />
        </SectionCard>
      ))}

      {sceneDetails.filter(Boolean).map((s) => (
        <SectionCard key={s!.id} title={`Scene · ${s!.name}`} accent="primary" action={<Badge tone={s!.status === "PUBLISHED" ? "success" : "neutral"}>{s!.status === "PUBLISHED" ? `đang phục vụ v${s!.activeVersionNo}` : s!.status}</Badge>}>
          <VersionTable versions={s!.versions ?? []} />
        </SectionCard>
      ))}

      {dashDetails.filter(Boolean).map((d) => (
        <SectionCard key={d!.id} title={`Bảng điều khiển · ${d!.name}`} accent="success" action={<Badge tone={d!.status === "PUBLISHED" ? "success" : "neutral"}>{d!.status === "PUBLISHED" ? `đang phục vụ v${d!.activeVersionNo}` : d!.status}</Badge>}>
          <VersionTable versions={d!.versions ?? []} />
        </SectionCard>
      ))}

      <SectionCard title="Quy tắc phiên bản" accent="neutral">
        <ul className="space-y-1 text-sm text-gray-600 dark:text-dark-200">
          <li>• Vòng đời: DRAFT → IN_REVIEW → PUBLISHED → SUPERSEDED → ARCHIVED.</li>
          <li>• Xuất bản lại KHÔNG sửa bản cũ: bản cũ chuyển SUPERSEDED, bản mới được ghi thêm.</li>
          <li>• Không có endpoint sửa/xoá cho một phiên bản đã xuất bản.</li>
          <li>• Rollback chỉ đổi phiên bản đang phục vụ; số lượng phiên bản không giảm.</li>
          <li>• Mọi lần xuất bản/rollback đều ghi nhật ký kiểm toán (ioc.*.publish / ioc.*.rollback).</li>
        </ul>
      </SectionCard>
    </div>
  );
}
