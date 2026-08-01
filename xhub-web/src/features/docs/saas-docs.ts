// -----------------------------------------------------------------------------
// SaaS docs registry — single source of truth mapping a stable kebab-case slug to
// the markdown filename under docs/saas/. Consumed by the SaaS index page and the
// [slug] server-read page. Slugs are the kebab-case of the filename (without .md,
// lowercased). Additive: does NOT modify the .md content.
// -----------------------------------------------------------------------------

export type SaasDocGroup = "positioning" | "platform" | "delivery";

export interface SaasDoc {
  slug: string;
  file: string;
  title: string;
  desc: string;
  group: SaasDocGroup;
}

export const SAAS_GROUPS: { id: SaasDocGroup; label: string }[] = [
  { id: "positioning", label: "Định vị & di trú" },
  { id: "platform", label: "Nền tảng" },
  { id: "delivery", label: "Triển khai & tenant" },
];

export const SAAS_DOCS: SaasDoc[] = [
  // Định vị & di trú
  {
    slug: "saas-positioning-delta-analysis",
    file: "SAAS_POSITIONING_DELTA_ANALYSIS.md",
    title: "Phân tích khoảng cách định vị SaaS",
    desc: "Delta giữa hiện trạng codebase và định vị SaaS đa tenant theo handoff Tenant 001–010.",
    group: "positioning",
  },
  {
    slug: "tenant-numbering-migration-plan",
    file: "TENANT_NUMBERING_MIGRATION_PLAN.md",
    title: "Kế hoạch di trú đánh số tenant",
    desc: "Chuẩn hoá cách đánh số & định danh tenant (001–010) và lộ trình migration.",
    group: "positioning",
  },
  {
    slug: "platform-vs-tenant-permission-plan",
    file: "PLATFORM_VS_TENANT_PERMISSION_PLAN.md",
    title: "Phân quyền nền tảng vs tenant",
    desc: "Ranh giới quyền cấp nền tảng (platform) và quyền trong từng tenant.",
    group: "positioning",
  },
  // Nền tảng
  {
    slug: "tenant-registry-implementation-plan",
    file: "TENANT_REGISTRY_IMPLEMENTATION_PLAN.md",
    title: "Sổ đăng ký tenant (Registry)",
    desc: "Kế hoạch hiện thực Platform Tenant Registry — sổ đăng ký tenant cấp nền tảng.",
    group: "platform",
  },
  {
    slug: "tenant-launch-factory-plan",
    file: "TENANT_LAUNCH_FACTORY_PLAN.md",
    title: "Nhà máy khởi tạo tenant",
    desc: "Quy trình launch factory: tạo & khởi động tenant mới một cách lặp lại được.",
    group: "platform",
  },
  {
    slug: "blueprint-seed-pack-plan",
    file: "BLUEPRINT_SEED_PACK_PLAN.md",
    title: "Blueprint & gói seed",
    desc: "Bộ blueprint và seed pack chuẩn để nạp dữ liệu khởi tạo cho tenant.",
    group: "platform",
  },
  {
    slug: "v1-saas-readiness-report",
    file: "V1_SAAS_READINESS_REPORT.md",
    title: "Báo cáo sẵn sàng SaaS v1.0",
    desc: "Tiêu chí thoát v1.0 (10 tenant live, cách ly, backup, entitlement, tách quyền, onboarding ≥11) + trạng thái từ endpoint readiness.",
    group: "platform",
  },
  // Triển khai & tenant
  {
    slug: "xtech-solution-delivery-plan",
    file: "XTECH_SOLUTION_DELIVERY_PLAN.md",
    title: "Bàn giao giải pháp XTech",
    desc: "Quy trình triển khai & bàn giao giải pháp XTech cho khách hàng.",
    group: "delivery",
  },
  {
    slug: "t002-real-estate-demo-plan",
    file: "T002_REAL_ESTATE_DEMO_PLAN.md",
    title: "T002 — Demo bất động sản",
    desc: "Kế hoạch tenant demo T002 cho lĩnh vực bất động sản.",
    group: "delivery",
  },
  {
    slug: "t003-t010-batch-plan",
    file: "T003_T010_BATCH_PLAN.md",
    title: "T003–T010 — Triển khai theo lô",
    desc: "Kế hoạch triển khai theo lô cho các tenant T003 đến T010.",
    group: "delivery",
  },
  {
    slug: "t011-customer-readiness-plan",
    file: "T011_CUSTOMER_READINESS_PLAN.md",
    title: "T011 — Sẵn sàng khách hàng",
    desc: "Kế hoạch chuẩn bị mức sẵn sàng (readiness) cho khách hàng thật, tenant T011.",
    group: "delivery",
  },
];

export function findSaasDoc(slug: string): SaasDoc | undefined {
  return SAAS_DOCS.find((d) => d.slug === slug);
}
