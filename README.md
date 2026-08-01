# XHub — SaaS Platform (X.Space · X.Office)

Nền tảng làm việc hợp nhất **đa‑tenant (SaaS)** do X‑TECH sở hữu & vận hành. Monorepo gồm 2 app + tài liệu.

| Repo | Stack | Cổng |
|---|---|---|
| `xhub-api` | NestJS + Prisma 7 + PostgreSQL (RLS đa‑tenant), BFF duy nhất chạm DB | `:4000` |
| `xhub-web` | Next.js 16 (App Router) + Tailwind v4, design system Tailux | `:3000` |

## Trạng thái
Platform 8/8 · PH‑00/01/02 (6 nghiệp vụ văn phòng điện tử) · **SaaS v1.0**: 10 tenant live (T001 chủ nền tảng + T002‑010 demo ngành), Platform Console, Launch Factory, Blueprint/Seed Pack, backup định kỳ per‑tenant, onboarding khách hàng ≥T011, lifecycle DEMO↔LIVE (reset‑demo + go‑live checklist). ~27 gate tự động PASS.

## Bắt đầu (máy mới)
> DB Postgres + server + `.env` là **LOCAL** (không theo git). Xem **[MACHINE_HANDOFF_RUNBOOK.md](MACHINE_HANDOFF_RUNBOOK.md)** để dựng lại đầy đủ (env → `prisma db push` → `rls-setup` → seed theo thứ tự → provision tenant → chạy server → verify).

```bash
git clone https://github.com/ccn112/xhub-saas.git
# rồi làm theo MACHINE_HANDOFF_RUNBOOK.md
```

## Tài liệu
- [HANDOFF_XHUB.md](HANDOFF_XHUB.md) — đầu mối bàn giao PM.
- [PROJECT_STATUS_XHUB.md](PROJECT_STATUS_XHUB.md) · [TINH_HINH_DU_AN_XHUB.md](TINH_HINH_DU_AN_XHUB.md) (cho ChatGPT).
- Trong app: `/docs` (Nghiệp vụ · SaaS · Phát triển · Backlog · Hướng dẫn · **Kiểm thử** UAT tương tác).
- Kế hoạch + backlog: `xhub-web/docs/DEV_BACKLOG.md`, `xhub-web/docs/saas/*`.

## Nguyên tắc bất biến
Tenant isolation (RLS) · không chứng từ ERP giả · không secret trong DB/git · tenantNo immutable · Platform Console tách quyền khỏi Tenant Admin · AI draft‑first + người xác nhận.

🔴 **Rotate `ANTHROPIC_API_KEY`** (key cũ đã lộ; không nằm trong git nhưng cần thu hồi).
</content>
