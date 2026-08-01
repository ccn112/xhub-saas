import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { TwinPlan2D } from "@/components/ioc/TwinPlan2D";
import { TwinViewer } from "@/components/ioc/TwinViewer.client";
import { getScene, getRuntimeScene, listDataLayers, executeLayer, zoneMetrics, type LayerResult } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Xem trước 3D · XHub IOC" };
export const dynamic = "force-dynamic";

// IOC-S03 — 3D Scene preview (DT-02). Reads the PUBLISHED scene version and
// previews it with the live data layers bound to its zones. 2D is always
// rendered first (Constitution #9); the Babylon canvas is opt-in.
export default async function ScenePreview3DPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [scene, runtime, layers] = await Promise.all([getScene(id), getRuntimeScene(id), listDataLayers()]);

  // Execute exactly the layers this scene's bindings reference.
  const layerIds = [...new Set((runtime?.zones ?? []).flatMap((z) => z.binding?.dataLayerIds ?? []))];
  const results = await Promise.all(layerIds.map((lid) => executeLayer(lid)));
  const byId: Record<string, LayerResult> = {};
  results.forEach((r, i) => { if (r) byId[layerIds[i]] = r; });
  const zones = zoneMetrics(runtime, byId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{scene?.name ?? id} — xem trước 3D</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Khối 3D được đùn từ CHÍNH đa giác mét đã xuất bản; chiều cao khối tỉ lệ với chỉ số tải. Một nguồn hình học duy nhất.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {runtime ? <Badge tone="success">scene v{runtime.versionNo}</Badge> : <Badge tone="warning">chưa xuất bản</Badge>}
          <Link href={`/ioc/studio/scenes/${id}/floor-plan`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium dark:border-dark-500 dark:text-dark-100">Về trình vẽ</Link>
        </div>
      </div>

      {runtime ? (
        <SectionCard title="Xem trước" accent="primary">
          <TwinViewer scene={runtime} zones={zones} plan2d={<TwinPlan2D scene={runtime} zones={zones} height={460} />} />
        </SectionCard>
      ) : (
        <SectionCard title="Chưa có phiên bản xuất bản" accent="warning">
          <p className="text-sm text-gray-600 dark:text-dark-200">
            Runtime chỉ phục vụ phiên bản ĐÃ XUẤT BẢN. Hãy xuất bản mặt bằng rồi xuất bản scene trong{" "}
            <Link href={`/ioc/studio/scenes/${id}/floor-plan`} className="text-primary-600 hover:underline">trình vẽ</Link>.
          </p>
        </SectionCard>
      )}

      <SectionCard title={`Lớp dữ liệu gắn vào scene (${layerIds.length}/${layers.items.length})`} accent="neutral">
        <ul className="grid gap-2 sm:grid-cols-3">
          {layerIds.map((lid) => {
            const l = byId[lid];
            return (
              <li key={lid} className="rounded-lg border border-gray-200 p-2.5 text-xs dark:border-dark-600">
                <p className="font-medium text-gray-800 dark:text-dark-50">{l?.name ?? lid}</p>
                <p className="mt-0.5 text-gray-400">{l ? `${l.entityKey} · ${l.visualMode} · tổng ${l.total}` : "không tải được"}</p>
              </li>
            );
          })}
          {layerIds.length === 0 ? <li className="text-sm text-gray-400">Chưa gắn lớp dữ liệu nào vào vùng.</li> : null}
        </ul>
      </SectionCard>
    </div>
  );
}
