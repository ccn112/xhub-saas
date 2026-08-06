"use client";

// Live style-guide page — renders the REAL xhub/ui + Tailux vendor components
// through the app's own Tailwind pipeline (no hardcoded hex/mockup markup), so
// this page shows exactly what the running app looks like today. Built to let
// the product owner click-verify the locked design decisions (05/08/2026):
// always-confirm delete, typed-code gate for financial/sensitive records, and
// the current typography/color/component set from
// docs/design-system/TAILUX_PAGE_PATTERNS.md + docs/DEVELOPER_GUIDE.md §3.
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { ConfirmDialog } from "@/xhub/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { DesignSystemSubNav } from "./DesignSystemSubNav";

export function DesignSystemShowcase() {
  const toast = useToast();
  const [confirmNormalOpen, setConfirmNormalOpen] = useState(false);
  const [confirmTypedOpen, setConfirmTypedOpen] = useState(false);

  async function simulateDelete(label: string) {
    await new Promise((r) => setTimeout(r, 900)); // fake latency so the loading state is visible
    toast.success(`Đã xoá ${label} (mô phỏng — không đụng dữ liệu thật)`);
  }

  return (
    <div className="space-y-6">
      <DesignSystemSubNav />
      {/* ── 1. Typography ─────────────────────────────────────────── */}
      <SectionCard title="1. Bộ chữ — Inter (nội dung) · Plus Jakarta Sans (tiêu đề)" accent="primary">
        <div className="divide-y divide-gray-100 dark:divide-dark-600">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="font-heading text-4xl font-bold">Doanh thu quý 3 tăng 18%</span>
            <span className="shrink-0 font-mono text-xs text-gray-400">H1 · 36px/700</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="font-heading text-2xl font-bold">Hợp đồng &amp; nghĩa vụ thanh toán</span>
            <span className="shrink-0 font-mono text-xs text-gray-400">H2 · 24px/700</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="font-heading text-lg font-semibold">Cơ hội bán hàng — X-TECH</span>
            <span className="shrink-0 font-mono text-xs text-gray-400">H3 · 18px/600</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="text-base">Khách hàng Riverside vừa ký hợp đồng CT-2026-014.</span>
            <span className="shrink-0 font-mono text-xs text-gray-400">base · 16px/400</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="text-sm-plus">sm-plus — ô nhập liệu, nhãn phụ trong bảng.</span>
            <span className="shrink-0 font-mono text-xs text-gray-400">sm-plus (riêng)</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="text-xs-plus text-gray-500 dark:text-dark-300">xs-plus — chú thích dưới biểu đồ, ngày giờ.</span>
            <span className="shrink-0 font-mono text-xs text-gray-400">xs-plus (riêng)</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="text-tiny text-gray-400 dark:text-dark-400">tiny — mã nội bộ, watermark.</span>
            <span className="shrink-0 font-mono text-xs text-gray-400">tiny (riêng)</span>
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Colors ─────────────────────────────────────────────── */}
      <SectionCard title="2. Bảng màu — token thật (Tailwind utility, không phải mã cứng)" accent="primary">
        <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-dark-300">Primary — thương hiệu #1769E0</p>
        <div className="mb-5 flex overflow-hidden rounded-lg border border-gray-200 dark:border-dark-600">
          {(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const).map((s) => (
            <div key={s} className={`h-10 flex-1 bg-primary-${s}`} title={`primary-${s}`} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-dark-300">Xám nền — gray</p>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-dark-600">
              {(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const).map((s) => (
                <div key={s} className={`h-9 flex-1 bg-gray-${s}`} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-dark-300">Nền tối — dark (chế độ tối)</p>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-dark-600">
              {(["50", "300", "400", "500", "600", "700", "750", "800", "900"] as const).map((s) => (
                <div key={s} className={`h-9 flex-1 bg-dark-${s}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="primary">Đang xử lý</Badge>
          <Badge tone="success">Hoàn thành</Badge>
          <Badge tone="warning">Sắp đến hạn</Badge>
          <Badge tone="error">Trễ hạn</Badge>
          <Badge tone="info">Ghi chú</Badge>
          <Badge tone="neutral">Nháp</Badge>
        </div>
      </SectionCard>

      {/* ── 3. Components ─────────────────────────────────────────── */}
      <SectionCard title="3. Component đang dùng" accent="primary">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-dark-100">Button (Tailux vendor)</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="filled" color="primary">Lưu thay đổi</Button>
              <Button variant="outlined" color="primary">Huỷ</Button>
              <Button variant="soft" color="primary">Xem chi tiết</Button>
              <Button variant="flat" color="neutral">Bỏ qua</Button>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-dark-100">StatCard</h3>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Giá trị hợp đồng" value="4,8 tỷ₫" tone="primary" icon="💰" />
              <StatCard label="PASS" value="92" tone="success" icon="✅" />
            </div>
          </Card>
          <Card className="p-4 sm:col-span-2">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-dark-100">AiRecap</h3>
            <AiRecap
              title="Tóm tắt (AI, chỉ đọc)"
              points={["3 hợp đồng sắp đến hạn thanh toán trong 7 ngày tới.", "1 cơ hội đứng yên quá 14 ngày ở giai đoạn Đàm phán."]}
            />
          </Card>
        </div>
      </SectionCard>

      {/* ── 4. ConfirmDialog — the locked decision, live ─────────── */}
      <SectionCard
        title="4. Xác nhận xoá — quyết định đã chốt 05/08/2026"
        accent="warning"
        action={<Badge tone="warning">Bấm thử được</Badge>}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-dark-200">
          Mọi hành động xoá trong XHub đều đi qua <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-dark-800">ConfirmDialog</code> — không có nơi nào xoá thẳng.
          Dữ liệu tài chính/nhạy cảm bắt buộc gõ lại đúng mã bản ghi mới xoá được. Bấm 2 nút dưới để thử trực tiếp (không đụng dữ liệu thật):
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outlined" color="error" onClick={() => setConfirmNormalOpen(true)}>
            Xoá khách hàng (mức thường)
          </Button>
          <Button variant="filled" color="error" onClick={() => setConfirmTypedOpen(true)}>
            Xoá hợp đồng CT-2026-014 (tài chính)
          </Button>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={confirmNormalOpen}
        onClose={() => setConfirmNormalOpen(false)}
        onConfirm={() => simulateDelete("khách hàng Sunrise Retail")}
        title="Xoá khách hàng Sunrise Retail?"
        description="Xoá xong không khôi phục lại được. Toàn bộ liên hệ và lịch sử hoạt động của khách hàng này cũng bị xoá theo."
      />

      <ConfirmDialog
        open={confirmTypedOpen}
        onClose={() => setConfirmTypedOpen(false)}
        onConfirm={() => simulateDelete("hợp đồng CT-2026-014")}
        title="Xoá hợp đồng CT-2026-014?"
        description="Đây là dữ liệu tài chính — hợp đồng Riverside Investment, giá trị 4.800.000.000₫. Xoá xong không khôi phục lại được."
        typedConfirmation={{ code: "CT-2026-014", hint: "Riverside Investment · 4.800.000.000₫" }}
      />
    </div>
  );
}
