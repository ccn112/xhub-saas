import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
// react-konva pulls konva's node entry (which requires the optional native
// `canvas` package) — it must never be server-rendered, so it is mounted through
// a "use client" shim doing dynamic(..., { ssr: false }) (ADR-0001).
import FloorPlanEditor from "@/components/ioc/FloorPlanEditorMount";
import { getScene, getPlan, listOrgUnits, listIcons } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Trình vẽ mặt bằng · XHub IOC" };
export const dynamic = "force-dynamic";

// IOC-S02 — Floor Plan Editor (DT-01). Draw zones in METERS, bind each to a REAL
// OrgUnit from Identity, pick an icon from the seeded catalog, autosave the
// draft, publish an immutable version.
export default async function FloorPlanEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cloned?: string; unmapped?: string }>;
}) {
  const { id } = await params;
  const { cloned, unmapped } = await searchParams;
  const unmappedCount = Number(unmapped ?? 0);
  const scene = await getScene(id);
  const plan = scene?.planId ? await getPlan(scene.planId) : null;
  const [orgUnits, icons] = await Promise.all([listOrgUnits(), listIcons()]);

  if (!scene || !plan) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Trình vẽ mặt bằng</h1>
        <SectionCard title="Không tìm thấy" accent="warning">
          <p className="text-sm text-gray-600 dark:text-dark-200">
            Không tìm thấy scene <code>{id}</code> (hoặc backend offline).{" "}
            <Link href="/ioc/studio" className="text-primary-600 hover:underline">Về Twin Studio</Link>
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{scene.name} — mặt bằng</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Toạ độ lưu theo MÉT. Mọi đa giác được máy chủ kiểm tra (tự cắt / suy biến / trùng id) trước khi lưu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={plan.status === "PUBLISHED" ? "success" : "neutral"}>{plan.status === "PUBLISHED" ? `mặt bằng v${plan.activeVersionNo}` : plan.status}</Badge>
          <Link href={`/ioc/studio/scenes/${scene.id}/3d`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium dark:border-dark-500 dark:text-dark-100">Xem 3D</Link>
          <Link href="/ioc/studio/publish" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium dark:border-dark-500 dark:text-dark-100">Xuất bản</Link>
        </div>
      </div>

      {/* Post-clone banner (DT-04). Honest by design: it names how many zones the
          clone could NOT bind, because the system refuses to invent an OrgUnit. */}
      {cloned ? (
        <SectionCard title={`Đã nhân bản từ template ${cloned}`} accent={unmappedCount > 0 ? "warning" : "success"}>
          <p className="text-sm text-gray-600 dark:text-dark-200">
            {unmappedCount > 0 ? (
              <>
                Đây là <strong>bản nháp của riêng bạn</strong>. Có <strong>{unmappedCount} vùng chưa gán đơn vị</strong> — hệ thống không
                tìm được đơn vị phù hợp trong cây tổ chức của tenant và <em>không tự tạo đơn vị ảo</em>. Hãy chọn từng vùng trên mặt bằng
                rồi gán đơn vị thật ở khung “Thuộc tính vùng”.
              </>
            ) : (
              <>
                Đây là <strong>bản nháp của riêng bạn</strong>. Tất cả vùng đã gán được vào đơn vị thật của tenant — bạn có thể chỉnh mặt
                bằng rồi xuất bản.
              </>
            )}
          </p>
        </SectionCard>
      ) : null}

      <SectionCard title="Trình vẽ" accent="primary" bodyClassName="space-y-3">
        <FloorPlanEditor
          plan={plan}
          orgUnits={orgUnits}
          bindings={scene.bindings ?? []}
          sceneId={scene.id}
          iconKeys={icons.items.map((i) => i.key)}
        />
      </SectionCard>

      <SectionCard title={`Lịch sử phiên bản mặt bằng (${plan.versions?.length ?? 0})`} accent="neutral">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {(plan.versions ?? []).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-gray-700 dark:text-dark-100">
                v{v.versionNo} · {new Date(v.publishedAt).toLocaleString("vi-VN")} · {v.publishedBy}
              </span>
              <span className="flex items-center gap-2">
                <code className="text-[11px] text-gray-400">{v.checksum.slice(0, 12)}…</code>
                <Badge tone={v.status === "PUBLISHED" ? "success" : "neutral"}>{v.status}</Badge>
              </span>
            </li>
          ))}
          {(plan.versions ?? []).length === 0 ? <li className="py-2 text-sm text-gray-400">Chưa xuất bản phiên bản nào.</li> : null}
        </ul>
      </SectionCard>
    </div>
  );
}
