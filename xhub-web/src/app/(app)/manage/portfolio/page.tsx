import Link from "next/link";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listPortfolios, listInitiatives, listObjectives } from "@/xoffice/lib/manage-data";
import { listProjects } from "@/xoffice/lib/work-projects-data";
import { CreateInitiativeForm } from "@/xoffice/manage/CreateInitiativeForm";
import { InitiativeGateButton } from "@/xoffice/manage/InitiativeGateButton";
import { LinkProjectForm } from "@/xoffice/manage/LinkProjectForm";

export const metadata = { title: "Danh mục đầu tư · XHub" };
export const dynamic = "force-dynamic";

const stageTone: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  INTAKE: "neutral",
  DISCOVERY: "info",
  APPROVED: "info",
  FUNDED: "info",
  DELIVERY: "warning",
  BENEFIT_REVIEW: "warning",
  CLOSED: "success",
  STOPPED: "error",
};

const healthTone: Record<string, "success" | "warning" | "error" | "neutral"> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "error",
  UNKNOWN: "neutral",
};

// MG-04 — Portfolio & Benefit. LINK layer only: Initiative.executionProjectId
// points at an EXISTING ExecutionProject (Work v2) — this screen never creates
// a project/milestone/task. Every progress/health figure shown here is read
// straight from Work v2 (labelled "Nguồn: Work v2"), never re-derived here.
// Distinct from the existing /work/portfolio delivery rollup (see
// MANAGEMENT_UI_ROUTE_PLAN §2 "một-portfolio-một-nguồn").
export default async function PortfolioPage() {
  const [{ items: portfolios, source: portfolioSource }, { items: initiatives, source: initSource }, { items: objectives }, { items: projects }] = await Promise.all([
    listPortfolios(),
    listInitiatives(),
    listObjectives(),
    listProjects({ pageSize: 100 }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Danh mục đầu tư</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">Initiative gắn với dự án thực thi có sẵn — không tạo lại engine dự án (Work v2 vẫn là nguồn tiến độ/sức khoẻ).</p>
        </div>
        <Badge tone={portfolioSource === "api" && initSource === "api" ? "success" : "warning"}>{portfolioSource === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <SectionCard title={`Portfolio (${portfolios.length})`} accent="primary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-100 p-3 dark:border-dark-600">
              <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{p.code} · {p.name}</p>
              <p className="mt-1 text-xs text-gray-400">{p.rollup.initiativeCount} initiative · {p.rollup.benefitCount} chỉ tiêu lợi ích</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(p.rollup.byStage).map(([stage, count]) => (
                  <Badge key={stage} tone={stageTone[stage] ?? "neutral"}>{stage} · {count}</Badge>
                ))}
              </div>
            </div>
          ))}
          {portfolios.length === 0 && <p className="text-sm text-gray-400">Chưa có portfolio nào — chạy npm run seed:manage-portfolio.</p>}
        </div>
      </SectionCard>

      <SectionCard title="Tạo initiative mới" accent="neutral">
        <CreateInitiativeForm objectives={objectives} />
      </SectionCard>

      <SectionCard title={`Initiative (${initiatives.length})`} accent="neutral">
        <ul className="divide-y divide-gray-100 dark:divide-dark-600">
          {initiatives.map((i) => (
            <li key={i.id} className="space-y-2 px-1 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">{i.code} · {i.name}</p>
                  <p className="text-xs text-gray-400">{i.strategicObjectiveIds.length} mục tiêu liên kết · {i.expectedBenefits.length} lợi ích kỳ vọng</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={stageTone[i.status] ?? "neutral"}>{i.status}</Badge>
                  <InitiativeGateButton id={i.id} status={i.status} />
                </div>
              </div>

              {i.delivery ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs dark:bg-dark-700/50">
                  <span className="text-gray-400">Nguồn: Work v2 ·</span>
                  <Badge tone={healthTone[i.delivery.health] ?? "neutral"}>{i.delivery.health}</Badge>
                  <span className="text-gray-500 dark:text-dark-300">{i.delivery.status} · {i.delivery.progressPercent}% hoàn thành</span>
                  <Link href={`/work/projects/${i.delivery.id}`} className="ml-auto font-medium text-primary-600 hover:underline dark:text-primary-400">
                    Xem thực thi →
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">Chưa gắn thực thi</Badge>
                  <LinkProjectForm initiativeId={i.id} projects={projects} />
                </div>
              )}
            </li>
          ))}
          {initiatives.length === 0 && <li className="py-3 text-sm text-gray-400">Chưa có initiative nào.</li>}
        </ul>
      </SectionCard>
    </div>
  );
}
