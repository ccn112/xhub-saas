import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listOpportunities, OPPORTUNITY_STAGE_LABEL, OPPORTUNITY_STAGE_TONE, formatMoney } from "@/xoffice/lib/revenue-data";

export const metadata = { title: "Cơ hội bán hàng · X.Office" };
export const dynamic = "force-dynamic";

const STAGE_FILTERS = ["", "LEAD", "QUALIFIED", "DISCOVERY", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const t = await getTranslations("sales");
  const sp = await searchParams;
  const stage = sp.stage ?? "";
  const { items, source } = await listOpportunities({ stage: stage || undefined });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">{t("opportunitiesTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">{t("opportunitiesSubtitle")}</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? t("backendConnected") : t("backendOffline")}</Badge>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">{t("colStage")}:</span>
          {STAGE_FILTERS.map((s) => (
            <Link
              key={s || "ALL"}
              href={`/office/opportunities${s ? `?stage=${s}` : ""}`}
              className={`rounded-full border px-3 py-1 ${s === stage ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {s ? OPPORTUNITY_STAGE_LABEL[s] ?? s : t("allFilter")}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">{t("colDeal")}</th>
              <th className="px-3 py-2 font-medium">{t("colCustomer")}</th>
              <th className="px-3 py-2 font-medium">{t("colExpectedAmount")}</th>
              <th className="px-3 py-2 font-medium">Xác suất</th>
              <th className="px-3 py-2 font-medium">{t("colStage")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2">
                  <Link href={`/office/opportunities/${o.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {o.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{o.customer?.name ?? "—"}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-dark-100">{formatMoney(o.expectedAmount, o.currency)}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{o.probability != null ? `${Math.round(o.probability * 100)}%` : "—"}</td>
                <td className="px-3 py-2">
                  <Badge tone={OPPORTUNITY_STAGE_TONE[o.stage] ?? "neutral"}>{OPPORTUNITY_STAGE_LABEL[o.stage] ?? o.stage}</Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  {source === "offline" ? t("emptyOffline") : t("emptyOpportunities")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
