import { getTranslations } from "next-intl/server";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listCatalogItems } from "@/xoffice/lib/revenue-data";

export const metadata = { title: "Danh mục thương mại · X.Office" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const t = await getTranslations("sales");
  const { items, source } = await listCatalogItems();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">{t("catalogTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">{t("catalogSubtitle")}</p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? t("backendConnected") : t("backendOffline")}</Badge>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">{t("colItemCode")}</th>
              <th className="px-3 py-2 font-medium">{t("colItemName")}</th>
              <th className="px-3 py-2 font-medium">{t("colItemType")}</th>
              <th className="px-3 py-2 font-medium">{t("colPriceModel")}</th>
              <th className="px-3 py-2 font-medium">{t("colVersion")}</th>
              <th className="px-3 py-2 font-medium">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-dark-50">{i.code}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-dark-100">{i.name}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{i.commercialType}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{i.priceModel ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">v{i.version}</td>
                <td className="px-3 py-2">
                  <Badge tone={i.active ? "success" : "neutral"}>{i.active ? t("colActive") : t("statusInactive")}</Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  {source === "offline" ? t("emptyOffline") : t("emptyCatalog")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
