// -----------------------------------------------------------------------------
// XHub canonical navigation model — ONE tree, consumed by BOTH renderers
// (rail-context + expanded) and the mobile bottom navigation.
//
// Rules (handoff CLAUDE.md):
//   - Single navigation model; renderers never define their own tree.
//   - Only items that map to a REAL existing route are present here. Items with
//     no screen (customers, documents, reports, admin, projects/mine, ...) are
//     intentionally omitted, so they never reach the DOM.
//   - `href` is the real navigation target (used as the level-1 link).
//   - `match` is the set of base paths used for route-derived active state.
//   - `badgeKey` is a KEY only; the numeric value comes from the badge resolver.
// -----------------------------------------------------------------------------
//
// PH-01 / NX-016 — MENU ROLE-VISIBILITY MAP (canonical role registry vocabulary,
// derived from handoff ROLE_CATALOG.csv / ROLE_PERMISSION_MATRIX.csv / MENU_TREE.csv,
// LEAST privilege that should see each item). `permission` is OPTIONAL: an item
// with no `permission` is visible to ALL authenticated users. Group headers with
// no `permission` are shown only when the actor can see ≥1 child (empty groups
// are pruned by filterNavByPermissions). Filtering is DEFAULT-SAFE — it only
// applies when the server signals enforcement (menuEnforce / AUTH_ENFORCE); dev,
// `*` (PLATFORM_ADMIN), and any permission-fetch failure show the FULL tree.
//
//   Trang chủ (home) + all children ......... ALL            → (none)
//   Công việc (work) rail ................... ALL            → (none)
//     Việc hằng ngày (group) ................ ALL            → (none, pruned to any child)
//       Hộp việc hợp nhất ................... ALL            → (none)
//       Trung tâm phê duyệt ................. APPROVER       → request.approve
//       Tổng quan ............................ ALL            → (none)
//       Việc của tôi ......................... ALL            → (none)
//       Tôi giao ............................. ALL            → (none)
//     Dự án & Portfolio (group) ............. ALL            → (none, pruned to any child)
//       Dự án thực thi ....................... ALL            → (none)
//       Dự án (MDM) .......................... ALL            → (none)
//       Kanban ............................... ALL            → (none)
//       Lịch công việc ....................... ALL            → (none)
//       Portfolio ............................ MANAGER        → work.portfolio.read
//       Báo cáo đa chiều ..................... MANAGER        → work.report.read
//   X.Space (space) + all children ......... ALL            → (none)
//   X.Office (office) rail .................. ALL            → (none)
//     Dịch vụ nội bộ (group) ................ ALL            → (none, pruned to any child)
//       Trung tâm yêu cầu .................... APPROVER       → request.approve
//       Yêu cầu của tôi ...................... ALL/requester  → request.create
//       Chỉ đạo & cam kết .................... ALL            → (none)
//       Service Desk ......................... ALL            → (none)
//       Đặt phòng & tài nguyên ............... ALL            → (none)
//       Thông báo nội bộ ..................... ALL            → (none)
//     Quản trị quy trình (group) ............ (any admin)    → (none, pruned to any child)
//       Danh mục quy trình ................... WORKFLOW_ADMIN → workflow.*
//       Vận hành (Instances) ................. WORKFLOW_ADMIN → workflow.*
//       Giám sát vận hành .................... WORKFLOW_ADMIN → workflow.*
//   Doanh nghiệp (business) rail ........... ALL            → (none)
//     Khách hàng (group) .................... SALES/customer → mdm.*
//     Tài liệu .............................. ALL/records    → document.read
//     Báo cáo ............................... MANAGER/exec   → dashboard.executive
//     Ứng dụng .............................. TENANT_ADMIN   → application.*
//     Quản trị hệ thống (group) ............. (any admin)    → (none, pruned to any child)
//       Tổng quan quản trị .................. TENANT_ADMIN   → tenant.*
//       Người dùng & thành viên ............. TENANT_ADMIN   → tenant.*
//       Sơ đồ tổ chức ....................... ORG_ADMIN      → org.*
//       Vị trí & người giữ .................. ORG_ADMIN      → org.*
//       Vai trò & quyền ..................... SECURITY_ADMIN → role.*
//       Phạm vi dữ liệu ..................... SECURITY_ADMIN → scope.*
//       Uỷ quyền & người thay ............... ORG_ADMIN      → delegation.*
//       Kiểm tra phân công .................. ORG_ADMIN      → org.*
//       Quản lý backup ...................... BACKUP_ADMIN   → backup.*
//       Khôi phục (restore) ................. BACKUP_ADMIN   → backup.*
//       Nhật ký kiểm toán ................... AUDITOR        → audit.read
//       Cấu hình tenant ..................... TENANT_ADMIN   → tenant.*
//     Tài liệu & Kiểm thử (docs) + children . ALL            → (none)
// -----------------------------------------------------------------------------

export interface XNavItem {
  id: string;
  label: string;
  /** Icon key (resolved against src/navigation/icons). Level-1 items only. */
  icon?: string;
  /** Real navigation target. */
  href: string;
  /** Base paths for route-derived active state. Defaults to [href]. */
  match?: string[];
  /** Permission gate (demo grants all). */
  permission?: string;
  /** Tenant entitlement gate. */
  entitlement?: string;
  /** Badge key resolved to a number by the badge resolver. */
  badgeKey?: string;
  /** Placeholder ("sắp có") — rendered but not a live route. */
  placeholder?: boolean;
  /**
   * Level-1 ONLY. Rail grouping: "platform" clusters platform-operator /
   * cross-tenant surfaces (Platform Console, Solution Delivery, IOC) visually
   * separate from — and pinned below — the core tenant-business workspaces
   * (default, unset = "core"). Purely a rail-rendering hint; does not affect
   * routing, permissions, or the prime-panel tree.
   */
  group?: "core" | "platform";
  children?: XNavItem[];
}

// -----------------------------------------------------------------------------
// Level-1 = WORKSPACE (the outermost / parent level shown on the icon rail).
// The rail is a coarse grouping, NOT a flat list of every screen — each
// workspace's real screens live one level down and render in the prime
// (context) panel. Originally "deliberately kept to 5 workspaces"; that core
// tenant-business group still stands, but later additive phases registered
// more top-level entries alongside it (each documented at its own block below
// with why it doesn't disturb the original 5) — the rail today has 10:
//
//   Original 5 tenant-business workspaces:
//   1. home     — Trang chủ (dashboards + thông báo)
//   2. work     — Công việc (hộp việc · phê duyệt · chỉ đạo · dự án)
//   3. space    — X.Space (trao đổi / cộng tác)
//   4. office   — X.Office (quy trình / vận hành)
//   5. business — Doanh nghiệp & Quản trị (khách hàng · tài liệu · báo cáo · ứng dụng · quản trị)
//
//   Later additive workspaces (each gated, each documented at its block):
//   6. manage   — "Điều hành" (MG-01→04: mục tiêu/KPI/OKR/review/quyết định/portfolio)
//   7. people   — "Nhân sự & Chấm công" (PE-01/PE-02: nghỉ phép/hiện diện nhóm/chấm công)
//   8. platform — "Bảng điều khiển nền tảng" (SaaS operator surface, PLT_ namespace)
//   9. delivery — "Triển khai giải pháp" (customer engagement lifecycle)
//  10. ioc      — IOC Digital Twin (bản sao số văn phòng/phòng ban)
// -----------------------------------------------------------------------------
export const XHUB_NAVIGATION: XNavItem[] = [
  {
    id: "home",
    label: "Trang chủ",
    icon: "home",
    href: "/home/executive",
    match: ["/home", "/notifications"],
    // ALL authenticated users — no gate (dashboards + notifications open to all).
    children: [
      { id: "home.executive", label: "Tổng quan điều hành", href: "/home/executive", icon: "chart" },
      { id: "home.sales", label: "Bảng điều hành kinh doanh", href: "/home/sales", icon: "sales" },
      { id: "home.me", label: "Không gian của tôi", href: "/home/me", icon: "me" },
      { id: "notifications.all", label: "Thông báo", href: "/notifications", icon: "bell", match: ["/notifications"] },
    ],
  },
  // ---------------------------------------------------------------------------
  // X.Office Management Operating System — MG-01 "reference slice" (leadership
  // layer). Placed AFTER home / BEFORE work per UI_ROUTE_PLAN option PA: this is
  // the executive workspace (BOARD/CEO/EXECUTIVE), distinct from operational
  // /work/*. Namespace /manage/* — does NOT touch the existing 5 workspaces and
  // does NOT collide with /work/*, /projects or /tasks/[id]. Gated by manage.*
  // permissions (soft unless AUTH_ENFORCE): under enforcement, employees without
  // manage.* don't see the workspace; the demo grants all. Only screens with a
  // real route are registered (the rest of the 14-screen MOS catalog lands later).
  // ---------------------------------------------------------------------------
  {
    id: "manage",
    label: "Điều hành",
    icon: "chart",
    href: "/manage",
    match: ["/manage"],
    permission: "manage.objective.read",
    children: [
      { id: "manage.home", label: "Tổng quan điều hành", href: "/manage", icon: "chart", match: ["/manage"], permission: "manage.objective.read" },
      { id: "manage.objectives", label: "Mục tiêu chiến lược", href: "/manage/objectives", icon: "directive", match: ["/manage/objectives"], permission: "manage.objective.read" },
      { id: "manage.metrics", label: "Chỉ số / KPI", href: "/manage/metrics", icon: "chart", match: ["/manage/metrics"], permission: "manage.metric.read" },
      { id: "manage.reviews", label: "Rà soát (Business Review)", href: "/manage/reviews", icon: "calendar", match: ["/manage/reviews"], permission: "manage.review.read" },
      { id: "manage.decisions", label: "Quyết định (RAPID)", href: "/manage/decisions", icon: "list", match: ["/manage/decisions"], permission: "manage.decision.read" },
      // MG-03 — KPI/OKR/Scorecard, layered on the reference slice (#3/#9/#13: BSC/
      // OKR/KPI/task list stay distinct; no blended score may hide a red KPI, #5).
      { id: "manage.scorecards", label: "Scorecard", href: "/manage/scorecards", icon: "chart", match: ["/manage/scorecards"], permission: "manage.scorecard.read" },
      { id: "manage.okrs", label: "OKR", href: "/manage/okrs", icon: "directive", match: ["/manage/okrs"], permission: "manage.okr.read" },
      // MG-04 — Portfolio & Benefit. LINK layer over Initiative→ExecutionProject
      // (Work v2) — distinct from the existing /work/portfolio delivery rollup
      // (see MANAGEMENT_UI_ROUTE_PLAN §2 "một-portfolio-một-nguồn").
      { id: "manage.portfolio", label: "Danh mục đầu tư", href: "/manage/portfolio", icon: "briefcase", match: ["/manage/portfolio"], permission: "manage.portfolio.read" },
    ],
  },
  {
    id: "work",
    label: "Công việc",
    icon: "briefcase",
    href: "/inbox",
    match: ["/inbox", "/approvals", "/work", "/projects"],
    // Rail open to all employees; only "Phê duyệt" is gated (APPROVER).
    badgeKey: "inbox.open",
    children: [
      {
        id: "work.daily",
        label: "Việc hằng ngày",
        href: "/inbox",
        icon: "inbox",
        children: [
          { id: "inbox.unified", label: "Hộp việc hợp nhất", href: "/inbox", icon: "inbox", match: ["/inbox"], badgeKey: "inbox.open" },
          { id: "approvals.center", label: "Trung tâm phê duyệt", href: "/approvals", icon: "approvals", match: ["/approvals"], badgeKey: "approval.pending", permission: "request.approve" },
          // X.Office Work & PM v2 — W1 (NativeWorkItem). Overview + My Work + Tôi giao.
          // No nav permission (open to all authenticated users); write actions are
          // gated server-side by work.item.* and the read path enforces the summary/
          // full visibility tier (owner requirement #1).
          { id: "work.overview", label: "Tổng quan", href: "/work", icon: "chart", match: ["/work"] },
          { id: "work.myTasks", label: "Việc của tôi", href: "/work/tasks", icon: "work", match: ["/work/tasks"] },
          { id: "work.assignedByMe", label: "Tôi giao", href: "/work/tasks/assigned-by-me", icon: "approvals", match: ["/work/tasks/assigned-by-me"] },
        ],
      },
      {
        id: "work.projectsPortfolio",
        label: "Dự án & Portfolio",
        href: "/work/projects",
        icon: "projects",
        children: [
          // X.Office Work & PM v2 — W2 (ExecutionProject). Delivery projects with WBS
          // roll-up + baseline + coordination visibility. Open in nav; writes gated
          // server-side by work.project.*; detail read enforces FULL/SUMMARY per actor.
          { id: "work.projects", label: "Dự án thực thi", href: "/work/projects", icon: "projects", match: ["/work/projects"] },
          { id: "projects.list", label: "Dự án (MDM)", href: "/projects", icon: "projects", match: ["/projects"] },
          // X.Office Work & PM v2 — W3 (Management Views). Kanban / Calendar / Portfolio
          // / multi-dimensional reports. Gantt is reached from project detail
          // (/work/projects/[id]/gantt). Open in nav; portfolio + reports reads gated
          // server-side (work.portfolio.read / work.report.read) — soft unless AUTH_ENFORCE.
          { id: "work.board", label: "Kanban", href: "/work/board", icon: "apps", match: ["/work/board"] },
          { id: "work.calendar", label: "Lịch công việc", href: "/work/calendar", icon: "calendar", match: ["/work/calendar"] },
          { id: "work.portfolio", label: "Portfolio", href: "/work/portfolio", icon: "chart", match: ["/work/portfolio"], permission: "work.portfolio.read" },
          { id: "work.reports", label: "Báo cáo đa chiều", href: "/work/reports", icon: "list", match: ["/work/reports"], permission: "work.report.read" },
        ],
      },
    ],
  },
  {
    id: "space",
    label: "X.Space",
    icon: "space",
    href: "/space/home",
    match: ["/space"],
    // X.Space is collaboration — open to all authenticated users.
    badgeKey: "space.unread",
    children: [
      { id: "space.home", label: "Trang chủ X.Space", href: "/space/home", icon: "space" },
      {
        id: "space.channel",
        label: "Channel triển khai FinERP",
        href: "/space/channels/trien-khai-finerp-minh-phat",
        icon: "channel",
        match: ["/space/channels/trien-khai-finerp-minh-phat"],
        children: [
          {
            id: "space.channel.conversation",
            label: "Hội thoại",
            href: "/space/channels/trien-khai-finerp-minh-phat",
          },
          {
            id: "space.channel.overview",
            label: "Tổng quan dự án",
            href: "/space/channels/trien-khai-finerp-minh-phat/overview",
          },
        ],
      },
      {
        id: "space.customer",
        label: "Channel khách hàng (360)",
        href: "/space/channels/kh-minh-phat/customer",
        icon: "customer",
      },
      { id: "space.dm", label: "Tin nhắn trực tiếp", href: "/space/dm/user-thuha", icon: "dm" },
    ],
  },
  {
    id: "office",
    label: "X.Office",
    icon: "office",
    href: "/office/workflows",
    match: ["/office"],
    // Rail open to all; workflow admin screens gated (WORKFLOW_ADMIN → workflow.*).
    children: [
      {
        id: "office.services",
        label: "Dịch vụ nội bộ",
        href: "/office/requests",
        icon: "inbox",
        children: [
          // Request module (PH-02a — NX-020..024). Request Center is approver-facing
          // (gated by request.approve / workflow.*); My Requests is requester-facing
          // (open to request.create). Enforcement lives in the API guards.
          { id: "office.requests", label: "Trung tâm yêu cầu", href: "/office/requests", icon: "inbox", match: ["/office/requests"], permission: "request.approve" },
          { id: "office.my-requests", label: "Yêu cầu của tôi", href: "/office/my-requests", icon: "work", match: ["/office/my-requests"], permission: "request.create" },
          // Directive / Decision / Commitment module (PH-02b — NX-025). No nav
          // permission so assignees (commitment holders) can reach directives given
          // to them; the issue/complete/cancel actions are gated server-side by
          // directive.issue (EXECUTIVE) in the API guards.
          { id: "office.directives", label: "Chỉ đạo & cam kết", href: "/office/directives", icon: "directive", match: ["/office/directives"] },
          // No nav permission — anyone can raise a ticket; manage actions are guarded
          // server-side (ticket.manage / ticket.resolve).
          { id: "office.service-desk", label: "Service Desk", href: "/office/service-desk", icon: "lifebuoy", match: ["/office/service-desk"] },
          { id: "office.bookings", label: "Đặt phòng & tài nguyên", href: "/office/bookings", icon: "calendar", match: ["/office/bookings"] },
          { id: "office.announcements", label: "Thông báo nội bộ", href: "/office/announcements", icon: "announce", match: ["/office/announcements"] },
        ],
      },
      {
        id: "office.workflowAdmin",
        label: "Quản trị quy trình",
        href: "/office/workflows",
        icon: "office",
        children: [
          { id: "office.workflows", label: "Danh mục quy trình", href: "/office/workflows", icon: "office", match: ["/office/workflows"], permission: "workflow.*" },
          { id: "office.instances", label: "Vận hành (Instances)", href: "/office/instances", icon: "work", match: ["/office/instances"], permission: "workflow.*" },
          { id: "office.monitor", label: "Giám sát vận hành", href: "/office/monitor", icon: "chart", match: ["/office/monitor"], permission: "workflow.*" },
        ],
      },
    ],
  },
  {
    id: "business",
    label: "Doanh nghiệp",
    icon: "business",
    href: "/customers",
    match: ["/customers", "/documents", "/reports", "/apps", "/admin", "/docs"],
    // Enterprise hub rail open to all; individual modules gated below.
    children: [
      {
        id: "customers",
        label: "Khách hàng",
        href: "/customers",
        icon: "customer",
        match: ["/customers"],
        permission: "mdm.*",
        children: [
          { id: "customers.list", label: "Danh sách khách hàng", href: "/customers", icon: "customer" },
          { id: "customers.c360", label: "Khách hàng Minh Phát (360)", href: "/customers/customer-minhphat", icon: "customer" },
        ],
      },
      { id: "documents.library", label: "Tài liệu", href: "/documents", icon: "folder", match: ["/documents"], permission: "document.read" },
      { id: "reports.summary", label: "Báo cáo", href: "/reports", icon: "chart", match: ["/reports"], permission: "dashboard.executive" },
      { id: "apps.catalog", label: "Ứng dụng", href: "/apps", icon: "apps", match: ["/apps"], permission: "application.*" },
      {
        id: "admin.console",
        label: "Quản trị hệ thống",
        href: "/admin",
        icon: "settings",
        match: ["/admin"],
        // Group header intentionally UNGATED: shown only when the actor can see
        // ≥1 child (empty group pruned). Each child carries its own SECURITY /
        // ORG / TENANT / BACKUP / AUDIT gate so each admin sees only what they govern.
        children: [
          { id: "admin.overview", label: "Tổng quan quản trị", href: "/admin", icon: "chart", match: ["/admin"], permission: "tenant.*" },
          { id: "admin.users", label: "Người dùng & thành viên", href: "/admin/users", icon: "customer", match: ["/admin/users"], permission: "tenant.*" },
          { id: "admin.organization", label: "Sơ đồ tổ chức", href: "/admin/organization", icon: "business", match: ["/admin/organization"], permission: "org.*" },
          { id: "admin.positions", label: "Vị trí & người giữ", href: "/admin/positions", icon: "briefcase", match: ["/admin/positions"], permission: "org.*" },
          { id: "admin.roles", label: "Vai trò & quyền", href: "/admin/roles", icon: "settings", match: ["/admin/roles"], permission: "role.*" },
          { id: "admin.dataScopes", label: "Phạm vi dữ liệu", href: "/admin/data-scopes", icon: "folder", match: ["/admin/data-scopes"], permission: "scope.*" },
          { id: "admin.delegations", label: "Uỷ quyền & người thay", href: "/admin/delegations", icon: "approvals", match: ["/admin/delegations"], permission: "delegation.*" },
          { id: "admin.resolver", label: "Kiểm tra phân công", href: "/admin/assignment-resolver", icon: "work", match: ["/admin/assignment-resolver"], permission: "org.*" },
          { id: "admin.backups", label: "Quản lý backup", href: "/admin/backups", icon: "folder", match: ["/admin/backups"], permission: "backup.*" },
          { id: "admin.restores", label: "Khôi phục (restore)", href: "/admin/restores", icon: "office", match: ["/admin/restores"], permission: "backup.*" },
          { id: "admin.audit", label: "Nhật ký kiểm toán", href: "/admin/audit", icon: "list", match: ["/admin/audit"], permission: "audit.read" },
          { id: "admin.tenant", label: "Cấu hình tenant", href: "/admin/settings/tenant", icon: "settings", match: ["/admin/settings/tenant"], permission: "tenant.*" },
        ],
      },
      {
        id: "docs",
        label: "Tài liệu & Kiểm thử",
        href: "/docs",
        icon: "docs",
        match: ["/docs"],
        children: [
          { id: "docs.overview", label: "Tổng quan tài liệu", href: "/docs", icon: "docs", match: ["/docs"] },
          { id: "docs.business", label: "Tài liệu nghiệp vụ", href: "/docs/business", icon: "briefcase", match: ["/docs/business"] },
          { id: "docs.saas", label: "SaaS (Tenant 001–010)", href: "/docs/saas", icon: "business", match: ["/docs/saas"] },
          { id: "docs.developer", label: "Tài liệu phát triển", href: "/docs/developer", icon: "office", match: ["/docs/developer"] },
          { id: "docs.backlog", label: "Backlog phát triển", href: "/docs/backlog", icon: "list", match: ["/docs/backlog"] },
          { id: "docs.user", label: "Hướng dẫn sử dụng", href: "/docs/user", icon: "guide", match: ["/docs/user"] },
          { id: "docs.test", label: "Kiểm thử (bot + tick)", href: "/docs/test", icon: "test", match: ["/docs/test"] },
        ],
      },
    ],
  },
  // -----------------------------------------------------------------------------
  // People Essentials — PE-01 "Leave & Availability" (owner-approved SME Lite
  // operating mode, PE-001, 2026-08-01). Placed AFTER business / BEFORE the
  // platform/delivery/ioc extended-surface group so the tenant-facing business
  // workspaces stay together. Does NOT touch the 5 original workspaces below
  // and does not collide with /admin/users (that stays the identity/account
  // registry; this is HR-essentials — leave/availability — a DIFFERENT domain).
  // -----------------------------------------------------------------------------
  {
    id: "people",
    label: "Nhân sự & Chấm công",
    icon: "customer",
    href: "/people",
    match: ["/people"],
    children: [
      { id: "people.home", label: "Tổng quan của tôi", href: "/people", icon: "me", match: ["/people"] },
      { id: "people.leave", label: "Nghỉ phép", href: "/people/leave", icon: "calendar", match: ["/people/leave"] },
      {
        id: "people.team.availability",
        label: "Lịch hiện diện nhóm",
        href: "/people/team/availability",
        icon: "customer",
        match: ["/people/team/availability"],
        permission: "people.team.availability.read",
      },
      // PE-02 — Attendance & Correction. Self-service view + "báo sai" — reuses
      // the same ApprovalTask queue as leave, no second approval mechanism.
      { id: "people.attendance", label: "Chấm công", href: "/people/attendance", icon: "calendar", match: ["/people/attendance"], permission: "people.self.attendance.read" },
      // HR-only: file import engine (SME Lite — attendanceMode=FILE_IMPORT).
      { id: "people.admin.import", label: "Nhập chấm công (HR)", href: "/people/admin/import", icon: "office", match: ["/people/admin/import"], permission: "people.hr.import.manage" },
    ],
  },
  // -----------------------------------------------------------------------------
  // PLATFORM CONSOLE (SAAS-004) — a SEPARATE surface, NOT a tenant workspace.
  // Gated by `platform.tenant.read`, granted ONLY by the `PLT_` platform-role
  // namespace (+ the dev/tenant PLATFORM_ADMIN=`*`). A normal tenant user under
  // enforcement lacks platform.* → filterNavByPermissions hides this whole
  // workspace (and every child). Kept after the core tenant/HR workspaces so
  // the original 5 tenant workspaces (+ manage + people) stay together.
  // -----------------------------------------------------------------------------
  {
    id: "platform",
    label: "Bảng điều khiển nền tảng",
    icon: "business",
    href: "/platform",
    match: ["/platform"],
    permission: "platform.tenant.read",
    group: "platform",
    children: [
      { id: "platform.overview", label: "Tổng quan SaaS", href: "/platform", icon: "chart", match: ["/platform"], permission: "platform.tenant.read" },
      { id: "platform.tenants", label: "Sổ đăng ký tenant", href: "/platform/tenants", icon: "business", match: ["/platform/tenants"], permission: "platform.tenant.read" },
      { id: "platform.plans", label: "Gói dịch vụ", href: "/platform/plans", icon: "apps", match: ["/platform/plans"], permission: "platform.tenant.read" },
      { id: "platform.readiness", label: "Sẵn sàng v1.0", href: "/platform/readiness", icon: "chart", match: ["/platform/readiness"], permission: "platform.tenant.read" },
      { id: "platform.launches", label: "Khởi chạy tenant", href: "/platform/launches", icon: "office", match: ["/platform/launches"], permission: "platform.launch.read" },
      { id: "platform.blueprints", label: "Blueprint", href: "/platform/blueprints", icon: "office", match: ["/platform/blueprints"], permission: "platform.blueprint.read" },
      { id: "platform.seed-packs", label: "Seed Pack", href: "/platform/seed-packs", icon: "office", match: ["/platform/seed-packs"], permission: "platform.blueprint.read" },
      { id: "platform.backups", label: "Backup định kỳ", href: "/platform/backups", icon: "folder", match: ["/platform/backups"], permission: "platform.backup.read" },
    ],
  },
  // -----------------------------------------------------------------------------
  // SOLUTION DELIVERY WORKSPACE (SaaS step 5) — the THIRD workspace type. Owned by
  // T001 (X-TECH) as solution provider: it manages the customer delivery lifecycle
  // (engagements) and, at GO_LIVE, launches customer tenants via the Launch
  // Factory. NOT a tenant business workspace and NOT the Platform Console. Gated by
  // `delivery.read` (granted by SOLUTION_DELIVERY_MANAGER + dev/tenant
  // PLATFORM_ADMIN=`*`) so normal tenant users under enforcement don't see it. Kept
  // after Platform Console so the 5 tenant workspaces stay intact.
  // -----------------------------------------------------------------------------
  {
    id: "delivery",
    label: "Triển khai giải pháp",
    icon: "briefcase",
    href: "/delivery",
    match: ["/delivery"],
    permission: "delivery.read",
    group: "platform",
    children: [
      { id: "delivery.overview", label: "Tổng quan pipeline", href: "/delivery", icon: "chart", match: ["/delivery"], permission: "delivery.read" },
      { id: "delivery.engagements", label: "Dự án triển khai", href: "/delivery/engagements", icon: "briefcase", match: ["/delivery/engagements"], permission: "delivery.read" },
    ],
  },
  // -----------------------------------------------------------------------------
  // XHub ENTERPRISE IOC — DIGITAL TWIN (DT-01..DT-03). An ENTITLED workspace, not
  // a new rail concept: docs/17_UI_SCREEN_CATALOG.md says "do not create a new
  // rail at MVP; register IOC as an entitled app/workspace entry", and in this
  // codebase a top-level XNavItem carrying a `permission` IS that entitlement
  // mechanism (filterNavByPermissions hides the whole subtree under AUTH_ENFORCE),
  // exactly as `platform` and `delivery` already do. Namespace /ioc/* — ADDITIVE:
  // it does not touch the 5 core workspaces, `manage`, `platform` or `delivery`.
  // Viewer screens are gated by `ioc.view`; every studio screen carries its own
  // ioc.studio.* / ioc.datalayer.manage gate, so an IOC operator sees the twin
  // without gaining the right to re-author it. Only screens with a REAL route are
  // registered — the department/process/people twins (DT-04..06) land later.
  // -----------------------------------------------------------------------------
  {
    id: "ioc",
    label: "IOC — Bản sao số",
    icon: "chart",
    href: "/ioc",
    match: ["/ioc"],
    permission: "ioc.view",
    group: "platform",
    children: [
      { id: "ioc.entry", label: "Trung tâm điều hành", href: "/ioc", icon: "chart", match: ["/ioc"], permission: "ioc.view" },
      { id: "ioc.twin.office", label: "Bản sao số văn phòng", href: "/ioc/twin/office", icon: "business", match: ["/ioc/twin/office"], permission: "ioc.view" },
      { id: "ioc.studio.templates", label: "Thư viện mẫu (nhân bản)", href: "/ioc/studio/templates", icon: "folder", match: ["/ioc/studio/templates"], permission: "ioc.studio.read" },
      { id: "ioc.studio", label: "Twin Studio", href: "/ioc/studio", icon: "office", match: ["/ioc/studio"], permission: "ioc.studio.read" },
      { id: "ioc.studio.dataLayers", label: "Lớp dữ liệu", href: "/ioc/studio/data-layers", icon: "list", match: ["/ioc/studio/data-layers"], permission: "ioc.datalayer.manage" },
      { id: "ioc.studio.dashboards", label: "Bảng điều khiển twin", href: "/ioc/studio/dashboards", icon: "apps", match: ["/ioc/studio/dashboards"], permission: "ioc.studio.read" },
      { id: "ioc.studio.assets", label: "Icon & asset", href: "/ioc/studio/assets", icon: "folder", match: ["/ioc/studio/assets"], permission: "ioc.asset.manage" },
      { id: "ioc.studio.publish", label: "Rà soát & xuất bản", href: "/ioc/studio/publish", icon: "settings", match: ["/ioc/studio/publish"], permission: "ioc.studio.publish" },
    ],
  },
];
