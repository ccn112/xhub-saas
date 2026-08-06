"use client";

// Live simulation of the 6 Tailux page-content/UX patterns indexed in
// docs/design-system/TAILUX_PAGE_PATTERNS.md — built with REAL xhub/ui
// components (not wireframes) over Revenue & Contract domain content, so the
// product owner can click through the actual locked-in conventions before
// they get reused on real new pages. Everything here is local/simulated —
// no network calls, no real data touched.
import { useState } from "react";
import { Card, SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { StatCard } from "@/xhub/ui/StatCard";
import { DataTable } from "@/xhub/ui/DataTable";
import { Pagination } from "@/xhub/ui/Pagination";
import { BarChart } from "@/xhub/ui/charts/BarChart";
import { DonutChart } from "@/xhub/ui/charts/DonutChart";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/xhub/ui/ConfirmDialog";
import { FormDrawer } from "@/xhub/ui/form/FormDrawer";
import { FormSection } from "@/xhub/ui/form/FormSection";
import { TextField, TextareaField, SelectField, SwitchField } from "@/xhub/ui/form/Fields";
import { useToast } from "@/components/ui/Toast";
import { DesignSystemSubNav } from "./DesignSystemSubNav";

// ── fake domain data, reused across sections ────────────────────────────
const CUSTOMERS = [
  { id: "c1", name: "Riverside Investment", status: "Hoạt động", owner: "Trần Thu Hà", createdAt: "12/07/2026" },
  { id: "c2", name: "Sunrise Retail", status: "Hoạt động", owner: "Trần Minh Quân", createdAt: "03/07/2026" },
  { id: "c3", name: "X-TECH Nội bộ", status: "Tiềm năng", owner: "Nguyễn Hải Nam", createdAt: "28/06/2026" },
  { id: "c4", name: "Minh Phát Logistics", status: "Hoạt động", owner: "Lê Thùy Linh", createdAt: "15/06/2026" },
  { id: "c5", name: "An Khang Retail", status: "Ngừng", owner: "Võ Hoàng Long", createdAt: "02/06/2026" },
];

export function PatternShowcase() {
  return (
    <div className="space-y-6">
      <DesignSystemSubNav />
      <HomeDashboardDemo />
      <ListingDemo />
      <DetailDemo />
      <PopupFormDemo />
      <WizardDemo />
      <SimpleFormDemo />
    </div>
  );
}

// ── 1. Home / Dashboard ──────────────────────────────────────────────────
function HomeDashboardDemo() {
  return (
    <SectionCard title="1. Trang chủ / Dashboard" accent="primary" action={<Badge tone="neutral">Mẫu demo</Badge>}>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Doanh thu tháng" value="18,6 tỷ₫" tone="primary" icon="💰" sub="+12,4% so với tháng trước" />
        <StatCard label="Hợp đồng hiệu lực" value="24" tone="success" icon="📄" />
        <StatCard label="Cơ hội đang mở" value="37" tone="info" icon="🎯" />
        <StatCard label="Nghĩa vụ sắp đến hạn" value="5" tone="warning" icon="⏰" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-dark-100">Doanh thu 6 tháng</h3>
          <BarChart
            categories={["T03", "T04", "T05", "T06", "T07", "T08"]}
            values={[12, 14, 13, 16, 15, 18.6]}
            seriesName="Doanh thu"
            unitLabel="tỷ₫"
          />
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-dark-100">Doanh thu theo sản phẩm</h3>
          <DonutChart labels={["Dịch vụ ERP", "Tư vấn", "Bảo trì", "Khác"]} values={[52, 27, 14, 7]} unit="%" height={260} />
        </Card>
      </div>
      <Card className="mt-4 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-dark-100">Hợp đồng gần đây</h3>
        <DataTable
          minWidthClass="min-w-[560px]"
          maxHeightClass="max-h-none"
          columns={[
            { key: "code", header: "Mã", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { key: "customer", header: "Khách hàng", cell: (r) => r.customer },
            { key: "amount", header: "Giá trị", cell: (r) => r.amount, align: "right" },
            { key: "status", header: "Trạng thái", cell: (r) => <Badge tone={r.tone as "success" | "warning"}>{r.status}</Badge> },
          ]}
          rows={[
            { code: "CT-2026-014", customer: "Riverside Investment", amount: "4.800.000.000₫", status: "Hiệu lực", tone: "success" },
            { code: "CT-2026-015", customer: "Sunrise Retail", amount: "1.150.000.000₫", status: "Chờ ký", tone: "warning" },
            { code: "CT-2026-013", customer: "Minh Phát Logistics", amount: "2.300.000.000₫", status: "Hiệu lực", tone: "success" },
          ]}
          rowKey={(r) => r.code}
        />
      </Card>
    </SectionCard>
  );
}

// ── 2. Listing ────────────────────────────────────────────────────────────
function ListingDemo() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmRow, setConfirmRow] = useState<(typeof CUSTOMERS)[number] | null>(null);

  return (
    <SectionCard
      title="2. Trang danh sách"
      accent="primary"
      action={<Button variant="filled" color="primary">+ Thêm khách hàng</Button>}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary-600 px-3 py-1 font-medium text-white">Tất cả</span>
        <span className="rounded-full border border-gray-200 px-3 py-1 text-gray-500 dark:border-dark-600 dark:text-dark-300">Hoạt động</span>
        <span className="rounded-full border border-gray-200 px-3 py-1 text-gray-500 dark:border-dark-600 dark:text-dark-300">Tiềm năng</span>
        <input
          disabled
          placeholder="Tìm khách hàng…"
          className="ml-auto w-48 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-400 dark:border-dark-600 dark:bg-dark-700"
        />
      </div>
      <Card className="p-0">
        <DataTable<(typeof CUSTOMERS)[number]>
          maxHeightClass="max-h-none"
          columns={[
            { key: "name", header: "Khách hàng", cell: (r) => <span className="font-medium text-gray-800 dark:text-dark-50">{r.name}</span> },
            {
              key: "status",
              header: "Trạng thái",
              cell: (r) => (
                <Badge tone={r.status === "Hoạt động" ? "success" : r.status === "Tiềm năng" ? "warning" : "neutral"}>{r.status}</Badge>
              ),
            },
            { key: "owner", header: "Phụ trách", cell: (r) => r.owner },
            { key: "createdAt", header: "Ngày tạo", cell: (r) => r.createdAt },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Button variant="flat" color="neutral" onClick={() => toast.success(`Mở sửa "${r.name}" (mô phỏng)`)}>Sửa</Button>
                  <Button variant="outlined" color="error" onClick={() => setConfirmRow(r)}>Xoá</Button>
                </div>
              ),
            },
          ]}
          rows={CUSTOMERS}
          rowKey={(r) => r.id}
        />
        <Pagination page={page} pageSize={pageSize} total={42} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>

      <ConfirmDialog
        open={!!confirmRow}
        onClose={() => setConfirmRow(null)}
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 700));
          toast.success(`Đã xoá khách hàng "${confirmRow?.name}" (mô phỏng)`);
        }}
        title={`Xoá khách hàng ${confirmRow?.name ?? ""}?`}
        description="Xoá xong không khôi phục lại được. Toàn bộ liên hệ liên quan cũng bị xoá theo."
      />
    </SectionCard>
  );
}

// ── 3. Detail ─────────────────────────────────────────────────────────────
function DetailDemo() {
  return (
    <SectionCard title="3. Trang chi tiết" accent="primary" action={<Badge tone="success">Hiệu lực</Badge>}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold text-gray-800 dark:text-dark-50">CT-2026-014</h3>
              <span className="text-sm text-gray-500 dark:text-dark-300">4.800.000.000₫</span>
            </div>
            <p className="mb-3 text-xs text-gray-400">Dòng hợp đồng · Chữ ký · Nghĩa vụ &amp; cảnh báo — 1 mạch cuộn, không tab</p>
            <div className="space-y-2">
              <div className="rounded-lg border border-gray-200 p-2.5 text-sm dark:border-dark-600">
                <div className="flex justify-between"><span>Triển khai ERP module Tài chính</span><span>3.200.000.000₫</span></div>
              </div>
              <div className="rounded-lg border border-gray-200 p-2.5 text-sm dark:border-dark-600">
                <div className="flex justify-between"><span>Bảo trì năm đầu</span><span>1.600.000.000₫</span></div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-dark-100">Lịch sử</h3>
            <ul className="space-y-1.5 text-sm text-gray-600 dark:text-dark-200">
              <li className="flex justify-between border-b border-gray-100 pb-1.5 dark:border-dark-700"><span>Ký hợp đồng (mock)</span><span className="text-xs text-gray-400">05/08/2026</span></li>
              <li className="flex justify-between"><span>Tạo hợp đồng từ báo giá</span><span className="text-xs text-gray-400">02/08/2026</span></li>
            </ul>
          </Card>
        </div>
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Khách hàng</p>
            <p className="font-heading mt-1 text-base font-semibold text-gray-800 dark:text-dark-50">Riverside Investment</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">Phụ trách: Trần Thu Hà</p>
          </Card>
          <Card className="p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Hợp đồng khác</p>
            <ul className="space-y-1 text-xs text-gray-500 dark:text-dark-300">
              <li>CT-2026-008 · Đã hoàn thành</li>
              <li>CT-2025-041 · Đã hoàn thành</li>
            </ul>
          </Card>
        </div>
      </div>
    </SectionCard>
  );
}

// ── 4. Popup form (drawer) ───────────────────────────────────────────────
function PopupFormDemo() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <SectionCard title="4. Form dạng popup (drawer)" accent="primary">
      <p className="mb-3 text-sm text-gray-500 dark:text-dark-300">Sửa nhanh 1 bản ghi, không rời khỏi ngữ cảnh đang xem.</p>
      <Button variant="filled" color="primary" onClick={() => setOpen(true)}>+ Thêm liên hệ</Button>

      <FormDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm liên hệ mới"
        description="Riverside Investment"
        submitLabel="Lưu"
        onSubmit={async () => {
          await new Promise((r) => setTimeout(r, 600));
          toast.success(`Đã lưu liên hệ "${name || "(chưa đặt tên)"}" (mô phỏng)`);
          setOpen(false);
          setName("");
        }}
      >
        <FormSection>
          <TextField label="Họ tên" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Thị Mai Anh" />
          <TextField label="Chức vụ" placeholder="Trưởng phòng Mua hàng" />
          <SelectField label="Kênh liên hệ ưu tiên" options={[{ value: "email", label: "Email" }, { value: "zalo", label: "Zalo" }, { value: "call", label: "Gọi điện" }]} placeholder="Chọn kênh" />
          <SwitchField label="Nhận thông báo hợp đồng" checked description="Gửi email khi có cập nhật hợp đồng" onChange={() => {}} />
        </FormSection>
      </FormDrawer>
    </SectionCard>
  );
}

// ── 5. Wizard (nhiều bước) ────────────────────────────────────────────────
const WIZARD_STEPS = ["Khách hàng & Cơ hội", "Điều khoản hợp đồng", "Xem lại & Hoàn tất"];

function WizardDemo() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [finished, setFinished] = useState(false);
  const [form, setForm] = useState({ customer: "", dealName: "", term: "12 tháng", penalty: "0,5%/ngày" });

  function goTo(i: number) {
    if (i <= maxReached) setStep(i);
  }
  function next() {
    const n = Math.min(step + 1, WIZARD_STEPS.length - 1);
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
  }

  if (finished) {
    return (
      <SectionCard title="5. Form điều hướng riêng trang — nhiều bước (Wizard)" accent="success">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="text-5xl">✅</span>
          <h3 className="font-heading text-lg font-semibold text-gray-800 dark:text-dark-50">Đã tạo hợp đồng thành công</h3>
          <p className="max-w-md text-sm text-gray-500 dark:text-dark-300">Hợp đồng cho {form.customer || "khách hàng"} đã sẵn sàng ở trạng thái DRAFT — vào trang Hợp đồng để thêm dòng và ký.</p>
          <Button variant="filled" color="primary" onClick={() => { setFinished(false); setStep(0); setMaxReached(0); }}>Làm lại demo</Button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="5. Form điều hướng riêng trang — nhiều bước (Wizard)" accent="primary">
      <p className="mb-4 text-sm text-gray-500 dark:text-dark-300">Chỉ dùng khi các bước phụ thuộc thứ tự thật sự — ví dụ tạo Hợp đồng từ đầu.</p>
      <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <div className="flex lg:flex-col gap-2">
          {WIZARD_STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              disabled={i > maxReached}
              onClick={() => goTo(i)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                i === step
                  ? "bg-primary-600 text-white"
                  : i < step
                    ? "bg-success/10 text-success-darker dark:text-success-lighter"
                    : "bg-gray-100 text-gray-500 dark:bg-dark-800 dark:text-dark-300"
              }`}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/30 text-[10px]">{i < step ? "✓" : i + 1}</span>
              {label}
            </button>
          ))}
        </div>
        <Card className="p-4">
          {step === 0 && (
            <FormSection title="Khách hàng & Cơ hội">
              <SelectField
                label="Khách hàng"
                required
                value={form.customer}
                onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))}
                options={CUSTOMERS.map((c) => ({ value: c.name, label: c.name }))}
                placeholder="Chọn khách hàng"
              />
              <TextField label="Tên cơ hội" required value={form.dealName} onChange={(e) => setForm((f) => ({ ...f, dealName: e.target.value }))} placeholder="Triển khai ERP giai đoạn 2" />
            </FormSection>
          )}
          {step === 1 && (
            <FormSection title="Điều khoản hợp đồng">
              <TextField label="Thời hạn hợp đồng" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} />
              <TextField label="Mức phạt trễ hạn" value={form.penalty} onChange={(e) => setForm((f) => ({ ...f, penalty: e.target.value }))} />
            </FormSection>
          )}
          {step === 2 && (
            <FormSection title="Xem lại">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between border-b border-gray-100 py-1.5 dark:border-dark-700"><span className="text-gray-400">Khách hàng</span><span>{form.customer || "—"}</span></div>
                <div className="flex justify-between border-b border-gray-100 py-1.5 dark:border-dark-700"><span className="text-gray-400">Cơ hội</span><span>{form.dealName || "—"}</span></div>
                <div className="flex justify-between border-b border-gray-100 py-1.5 dark:border-dark-700"><span className="text-gray-400">Thời hạn</span><span>{form.term}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-gray-400">Phạt trễ hạn</span><span>{form.penalty}</span></div>
              </div>
            </FormSection>
          )}
          <div className="mt-5 flex justify-end gap-2">
            {step > 0 && <Button variant="outlined" color="neutral" onClick={() => setStep((s) => s - 1)}>Quay lại</Button>}
            {step < WIZARD_STEPS.length - 1 ? (
              <Button variant="filled" color="primary" disabled={step === 0 && (!form.customer || !form.dealName)} onClick={next}>Tiếp theo</Button>
            ) : (
              <Button variant="filled" color="primary" onClick={() => { toast.success("Hợp đồng nháp đã tạo (mô phỏng)"); setFinished(true); }}>Hoàn tất</Button>
            )}
          </div>
        </Card>
      </div>
    </SectionCard>
  );
}

// ── 6. Simple 1-page form ─────────────────────────────────────────────────
function SimpleFormDemo() {
  const toast = useToast();
  const [dealName, setDealName] = useState("");

  return (
    <SectionCard
      title="6. Form tạo mới đơn giản — 1 trang"
      accent="primary"
      action={
        <div className="flex gap-2">
          <Button variant="outlined" color="neutral" onClick={() => toast.success("Xem trước (chưa nối hành vi thật, giữ đúng như demo Tailux gốc)")}>Xem trước</Button>
          <Button variant="filled" color="primary" type="submit" form="pattern-simple-form">Lưu</Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-gray-500 dark:text-dark-300">Phù hợp nhất cho việc lặp lại hằng ngày (Khách hàng/Cơ hội/Báo giá) — mọi khối hiện cùng lúc, không ẩn theo bước.</p>
      <form
        id="pattern-simple-form"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success(`Đã lưu cơ hội "${dealName || "(chưa đặt tên)"}" — form làm mới tại chỗ (mô phỏng)`);
          setDealName("");
        }}
        className="grid gap-4 lg:grid-cols-3"
      >
        <Card className="p-4 lg:col-span-2">
          <FormSection title="Thông tin chung">
            <TextField label="Tên cơ hội" required value={dealName} onChange={(e) => setDealName(e.target.value)} placeholder="Triển khai ERP giai đoạn 2" />
            <SelectField label="Khách hàng" required options={CUSTOMERS.map((c) => ({ value: c.name, label: c.name }))} placeholder="Chọn khách hàng" />
            <TextField label="Giá trị dự kiến" placeholder="3.200.000.000" />
            <TextareaField label="Ghi chú" placeholder="Bối cảnh, yêu cầu đặc biệt…" />
          </FormSection>
        </Card>
        <div className="space-y-4">
          <Card className="p-4">
            <FormSection>
              <SelectField label="Giai đoạn" options={[{ value: "lead", label: "Tiềm năng" }, { value: "qualified", label: "Đủ điều kiện" }, { value: "negotiation", label: "Đàm phán" }]} placeholder="Chọn giai đoạn" />
              <TextField label="Người phụ trách" placeholder="Trần Minh Quân" />
              <TextField label="Ngày dự kiến chốt" type="date" />
            </FormSection>
          </Card>
        </div>
      </form>
    </SectionCard>
  );
}
