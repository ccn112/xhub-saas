import Link from "next/link";
import { Card } from "@/xhub/ui/Card";
import { SAAS_DOCS, SAAS_GROUPS } from "@/features/docs/saas-docs";

export const metadata = { title: "SaaS · Tài liệu · XHub" };

export default function SaasDocsIndexPage() {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-gray-500 dark:text-dark-300">
        Bộ tài liệu hoạch định XHub SaaS đa tenant (Tenant 001–010): định vị & di trú, nền tảng khởi
        tạo tenant, và triển khai tới từng khách hàng. Các tài liệu dưới đây là bản kế hoạch (docs-first).
      </p>

      {SAAS_GROUPS.map((group) => {
        const docs = SAAS_DOCS.filter((d) => d.group === group.id);
        return (
          <section key={group.id} className="space-y-3">
            <h2 className="font-heading text-base font-semibold text-gray-700 dark:text-dark-100">
              {group.label}
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {docs.map((d) => (
                <Link key={d.slug} href={`/docs/saas/${d.slug}`} className="group block">
                  <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-soft-lg">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-primary-600/10 text-2xl">
                      🏢
                    </span>
                    <h3 className="font-heading mt-4 text-base font-semibold text-gray-800 group-hover:text-primary-600 dark:text-dark-50">
                      {d.title}
                    </h3>
                    <p className="mt-1.5 flex-1 text-sm leading-6 text-gray-500 dark:text-dark-300">{d.desc}</p>
                    <p className="mt-4 font-mono text-xs text-gray-400 dark:text-dark-400">docs/saas/{d.file}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
