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
    label: "home",
    icon: "home",
    href: "/home/executive",
    match: ["/home", "/notifications"],
    // ALL authenticated users — no gate (dashboards + notifications open to all).
    children: [
      { id: "home.executive", label: "home_executive", href: "/home/executive", icon: "chart" },
      { id: "home.sales", label: "home_sales", href: "/home/sales", icon: "sales" },
      { id: "home.me", label: "home_me", href: "/home/me", icon: "me" },
      { id: "notifications.all", label: "notifications_all", href: "/notifications", icon: "bell", match: ["/notifications"] },
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
    label: "manage",
    icon: "chart",
    href: "/manage",
    match: ["/manage"],
    permission: "manage.objective.read",
    children: [
      { id: "manage.home", label: "manage_home", href: "/manage", icon: "chart", match: ["/manage"], permission: "manage.objective.read" },
      { id: "manage.objectives", label: "manage_objectives", href: "/manage/objectives", icon: "directive", match: ["/manage/objectives"], permission: "manage.objective.read" },
      { id: "manage.metrics", label: "manage_metrics", href: "/manage/metrics", icon: "chart", match: ["/manage/metrics"], permission: "manage.metric.read" },
      { id: "manage.reviews", label: "manage_reviews", href: "/manage/reviews", icon: "calendar", match: ["/manage/reviews"], permission: "manage.review.read" },
      { id: "manage.decisions", label: "manage_decisions", href: "/manage/decisions", icon: "list", match: ["/manage/decisions"], permission: "manage.decision.read" },
      // MG-03 — KPI/OKR/Scorecard, layered on the reference slice (#3/#9/#13: BSC/
      // OKR/KPI/task list stay distinct; no blended score may hide a red KPI, #5).
      { id: "manage.scorecards", label: "manage_scorecards", href: "/manage/scorecards", icon: "chart", match: ["/manage/scorecards"], permission: "manage.scorecard.read" },
      { id: "manage.okrs", label: "manage_okrs", href: "/manage/okrs", icon: "directive", match: ["/manage/okrs"], permission: "manage.okr.read" },
      // MG-04 — Portfolio & Benefit. LINK layer over Initiative→ExecutionProject
      // (Work v2) — distinct from the existing /work/portfolio delivery rollup
      // (see MANAGEMENT_UI_ROUTE_PLAN §2 "một-portfolio-một-nguồn").
      { id: "manage.portfolio", label: "manage_portfolio", href: "/manage/portfolio", icon: "briefcase", match: ["/manage/portfolio"], permission: "manage.portfolio.read" },
    ],
  },
  {
    id: "work",
    label: "work",
    icon: "briefcase",
    href: "/inbox",
    match: ["/inbox", "/approvals", "/work", "/projects"],
    // Rail open to all employees; only "Phê duyệt" is gated (APPROVER).
    badgeKey: "inbox.open",
    children: [
      {
        id: "work.daily",
        label: "work_daily",
        href: "/inbox",
        icon: "inbox",
        children: [
          { id: "inbox.unified", label: "inbox_unified", href: "/inbox", icon: "inbox", match: ["/inbox"], badgeKey: "inbox.open" },
          { id: "approvals.center", label: "approvals_center", href: "/approvals", icon: "approvals", match: ["/approvals"], badgeKey: "approval.pending", permission: "request.approve" },
          // X.Office Work & PM v2 — W1 (NativeWorkItem). Overview + My Work + Tôi giao.
          // No nav permission (open to all authenticated users); write actions are
          // gated server-side by work.item.* and the read path enforces the summary/
          // full visibility tier (owner requirement #1).
          { id: "work.overview", label: "work_overview", href: "/work", icon: "chart", match: ["/work"] },
          { id: "work.myTasks", label: "work_myTasks", href: "/work/tasks", icon: "work", match: ["/work/tasks"] },
          { id: "work.assignedByMe", label: "work_assignedByMe", href: "/work/tasks/assigned-by-me", icon: "approvals", match: ["/work/tasks/assigned-by-me"] },
        ],
      },
      {
        id: "work.projectsPortfolio",
        label: "work_projectsPortfolio",
        href: "/work/projects",
        icon: "projects",
        children: [
          // X.Office Work & PM v2 — W2 (ExecutionProject). Delivery projects with WBS
          // roll-up + baseline + coordination visibility. Open in nav; writes gated
          // server-side by work.project.*; detail read enforces FULL/SUMMARY per actor.
          { id: "work.projects", label: "work_projects", href: "/work/projects", icon: "projects", match: ["/work/projects"] },
          { id: "projects.list", label: "projects_list", href: "/projects", icon: "projects", match: ["/projects"] },
          // X.Office Work & PM v2 — W3 (Management Views). Kanban / Calendar / Portfolio
          // / multi-dimensional reports. Gantt is reached from project detail
          // (/work/projects/[id]/gantt). Open in nav; portfolio + reports reads gated
          // server-side (work.portfolio.read / work.report.read) — soft unless AUTH_ENFORCE.
          { id: "work.board", label: "work_board", href: "/work/board", icon: "apps", match: ["/work/board"] },
          { id: "work.calendar", label: "work_calendar", href: "/work/calendar", icon: "calendar", match: ["/work/calendar"] },
          { id: "work.portfolio", label: "work_portfolio", href: "/work/portfolio", icon: "chart", match: ["/work/portfolio"], permission: "work.portfolio.read" },
          { id: "work.reports", label: "work_reports", href: "/work/reports", icon: "list", match: ["/work/reports"], permission: "work.report.read" },
        ],
      },
    ],
  },
  {
    id: "space",
    label: "space",
    icon: "space",
    href: "/space/home",
    match: ["/space"],
    // X.Space is collaboration — open to all authenticated users.
    badgeKey: "space.unread",
    children: [
      { id: "space.home", label: "space_home", href: "/space/home", icon: "space" },
      {
        id: "space.channel",
        label: "space_channel",
        href: "/space/channels/trien-khai-finerp-minh-phat",
        icon: "channel",
        match: ["/space/channels/trien-khai-finerp-minh-phat"],
        children: [
          {
            id: "space.channel.conversation",
            label: "space_channel_conversation",
            href: "/space/channels/trien-khai-finerp-minh-phat",
          },
          {
            id: "space.channel.overview",
            label: "space_channel_overview",
            href: "/space/channels/trien-khai-finerp-minh-phat/overview",
          },
        ],
      },
      {
        id: "space.customer",
        label: "space_customer",
        href: "/space/channels/kh-minh-phat/customer",
        icon: "customer",
      },
      { id: "space.dm", label: "space_dm", href: "/space/dm/user-thuha", icon: "dm" },
    ],
  },
  {
    id: "office",
    label: "office",
    icon: "office",
    href: "/office/workflows",
    match: ["/office", "/ioc"],
    // Rail open to all; workflow admin screens gated (WORKFLOW_ADMIN → workflow.*).
    children: [
      {
        id: "office.services",
        label: "office_services",
        href: "/office/requests",
        icon: "inbox",
        children: [
          // Request module (PH-02a — NX-020..024). Request Center is approver-facing
          // (gated by request.approve / workflow.*); My Requests is requester-facing
          // (open to request.create). Enforcement lives in the API guards.
          { id: "office.requests", label: "office_requests", href: "/office/requests", icon: "inbox", match: ["/office/requests"], permission: "request.approve" },
          { id: "office.my-requests", label: "office_my-requests", href: "/office/my-requests", icon: "work", match: ["/office/my-requests"], permission: "request.create" },
          // Directive / Decision / Commitment module (PH-02b — NX-025). No nav
          // permission so assignees (commitment holders) can reach directives given
          // to them; the issue/complete/cancel actions are gated server-side by
          // directive.issue (EXECUTIVE) in the API guards.
          { id: "office.directives", label: "office_directives", href: "/office/directives", icon: "directive", match: ["/office/directives"] },
          // No nav permission — anyone can raise a ticket; manage actions are guarded
          // server-side (ticket.manage / ticket.resolve).
          { id: "office.service-desk", label: "office_service-desk", href: "/office/service-desk", icon: "lifebuoy", match: ["/office/service-desk"] },
          { id: "office.bookings", label: "office_bookings", href: "/office/bookings", icon: "calendar", match: ["/office/bookings"] },
          { id: "office.announcements", label: "office_announcements", href: "/office/announcements", icon: "announce", match: ["/office/announcements"] },
        ],
      },
      {
        id: "office.sales",
        label: "office_sales",
        href: "/office/customers",
        icon: "customer",
        children: [
          // Phase 2 — Revenue & Contract MVP (BO-0201..0209). Reads open
          // (any tenant member browses); writes gated server-side by
          // customer.manage/opportunity.manage/catalog.manage/proposal.manage/
          // contract.manage (SALES_MANAGER/CONTRACT_MANAGER).
          { id: "office.customers", label: "office_customers", href: "/office/customers", icon: "customer", match: ["/office/customers"] },
          { id: "office.opportunities", label: "office_opportunities", href: "/office/opportunities", icon: "chart", match: ["/office/opportunities"] },
          { id: "office.catalog", label: "office_catalog", href: "/office/catalog", icon: "list", match: ["/office/catalog"] },
          { id: "office.contracts", label: "office_contracts", href: "/office/contracts", icon: "docs", match: ["/office/contracts"] },
          { id: "office.revenue-kpi", label: "office_revenue-kpi", href: "/office/revenue-kpi", icon: "chart", match: ["/office/revenue-kpi"] },
        ],
      },
      {
        id: "office.support",
        label: "office_support",
        href: "/office/support-cases",
        icon: "lifebuoy",
        children: [
          // Product Customer Support (2026-08-06) — external customer support
          // for X2/X1/FinERP/X.Space, distinct from the internal Service Desk
          // above. No nav permission — any support agent browses; writes gated
          // server-side by support-case.create/manage/resolve.
          { id: "office.support-cases", label: "office_support-cases", href: "/office/support-cases", icon: "lifebuoy", match: ["/office/support-cases"] },
        ],
      },
      {
        id: "office.workflowAdmin",
        label: "office_workflowAdmin",
        href: "/office/workflows",
        icon: "office",
        children: [
          { id: "office.workflows", label: "office_workflows", href: "/office/workflows", icon: "office", match: ["/office/workflows"], permission: "workflow.*" },
          { id: "office.instances", label: "office_instances", href: "/office/instances", icon: "work", match: ["/office/instances"], permission: "workflow.*" },
          { id: "office.monitor", label: "office_monitor", href: "/office/monitor", icon: "chart", match: ["/office/monitor"], permission: "workflow.*" },
          // Bộ tài liệu kiểm thử RIÊNG của X.Office (Phase 1.5 Stage D, 2026-08-04)
          // — tách khỏi /docs/test chung, chỉ phủ các nhóm do process xoffice phục vụ.
          { id: "office.docs.test", label: "office_docs_test", href: "/office/docs/test", icon: "test", match: ["/office/docs/test"] },
          // Tài liệu phát triển + backlog RIÊNG của X.Office (2026-08-04) — nhân
          // bản từ /docs/developer + /docs/backlog, đang chờ chuẩn hoá nội dung.
          { id: "office.docs.developer", label: "office_docs_developer", href: "/office/docs/developer", icon: "office", match: ["/office/docs/developer"] },
          { id: "office.docs.backlog", label: "office_docs_backlog", href: "/office/docs/backlog", icon: "list", match: ["/office/docs/backlog"] },
        ],
      },
      // XHub Enterprise IOC — Digital Twin (DT-01..DT-03), module con của khối
      // điều hành/quản lý văn phòng trong X.Office (2026-08-04 — dời từ rail
      // top-level riêng vào đây theo đúng ranh giới sản phẩm X.Office). Viewer
      // gated bởi ioc.view; mỗi màn studio giữ nguyên gate riêng
      // (ioc.studio.* / ioc.datalayer.manage) như trước khi dời.
      {
        id: "office.ioc",
        label: "office_ioc",
        href: "/ioc",
        icon: "chart",
        children: [
          { id: "ioc.entry", label: "ioc_entry", href: "/ioc", icon: "chart", match: ["/ioc"], permission: "ioc.view" },
          { id: "ioc.twin.office", label: "ioc_twin_office", href: "/ioc/twin/office", icon: "business", match: ["/ioc/twin/office"], permission: "ioc.view" },
          { id: "ioc.studio.templates", label: "ioc_studio_templates", href: "/ioc/studio/templates", icon: "folder", match: ["/ioc/studio/templates"], permission: "ioc.studio.read" },
          { id: "ioc.studio", label: "ioc_studio", href: "/ioc/studio", icon: "office", match: ["/ioc/studio"], permission: "ioc.studio.read" },
          { id: "ioc.studio.dataLayers", label: "ioc_studio_dataLayers", href: "/ioc/studio/data-layers", icon: "list", match: ["/ioc/studio/data-layers"], permission: "ioc.datalayer.manage" },
          { id: "ioc.studio.dashboards", label: "ioc_studio_dashboards", href: "/ioc/studio/dashboards", icon: "apps", match: ["/ioc/studio/dashboards"], permission: "ioc.studio.read" },
          { id: "ioc.studio.assets", label: "ioc_studio_assets", href: "/ioc/studio/assets", icon: "folder", match: ["/ioc/studio/assets"], permission: "ioc.asset.manage" },
          { id: "ioc.studio.publish", label: "ioc_studio_publish", href: "/ioc/studio/publish", icon: "settings", match: ["/ioc/studio/publish"], permission: "ioc.studio.publish" },
        ],
      },
    ],
  },
  {
    id: "business",
    label: "business",
    icon: "business",
    href: "/customers",
    match: ["/customers", "/documents", "/reports", "/apps", "/admin", "/docs"],
    // Enterprise hub rail open to all; individual modules gated below.
    children: [
      {
        id: "customers",
        label: "customers",
        href: "/customers",
        icon: "customer",
        match: ["/customers"],
        permission: "mdm.*",
        children: [
          { id: "customers.list", label: "customers_list", href: "/customers", icon: "customer" },
          { id: "customers.c360", label: "customers_c360", href: "/customers/customer-minhphat", icon: "customer" },
        ],
      },
      { id: "documents.library", label: "documents_library", href: "/documents", icon: "folder", match: ["/documents"], permission: "document.read" },
      { id: "reports.summary", label: "reports_summary", href: "/reports", icon: "chart", match: ["/reports"], permission: "dashboard.executive" },
      { id: "apps.catalog", label: "apps_catalog", href: "/apps", icon: "apps", match: ["/apps"], permission: "application.*" },
      {
        id: "admin.console",
        label: "admin_console",
        href: "/admin",
        icon: "settings",
        match: ["/admin"],
        // Group header intentionally UNGATED: shown only when the actor can see
        // ≥1 child (empty group pruned). Each child carries its own SECURITY /
        // ORG / TENANT / BACKUP / AUDIT gate so each admin sees only what they govern.
        children: [
          { id: "admin.overview", label: "admin_overview", href: "/admin", icon: "chart", match: ["/admin"], permission: "tenant.*" },
          { id: "admin.users", label: "admin_users", href: "/admin/users", icon: "customer", match: ["/admin/users"], permission: "tenant.*" },
          { id: "admin.organization", label: "admin_organization", href: "/admin/organization", icon: "business", match: ["/admin/organization"], permission: "org.*" },
          { id: "admin.positions", label: "admin_positions", href: "/admin/positions", icon: "briefcase", match: ["/admin/positions"], permission: "org.*" },
          { id: "admin.roles", label: "admin_roles", href: "/admin/roles", icon: "settings", match: ["/admin/roles"], permission: "role.*" },
          { id: "admin.dataScopes", label: "admin_dataScopes", href: "/admin/data-scopes", icon: "folder", match: ["/admin/data-scopes"], permission: "scope.*" },
          { id: "admin.delegations", label: "admin_delegations", href: "/admin/delegations", icon: "approvals", match: ["/admin/delegations"], permission: "delegation.*" },
          { id: "admin.resolver", label: "admin_resolver", href: "/admin/assignment-resolver", icon: "work", match: ["/admin/assignment-resolver"], permission: "org.*" },
          { id: "admin.backups", label: "admin_backups", href: "/admin/backups", icon: "folder", match: ["/admin/backups"], permission: "backup.*" },
          { id: "admin.restores", label: "admin_restores", href: "/admin/restores", icon: "office", match: ["/admin/restores"], permission: "backup.*" },
          { id: "admin.audit", label: "admin_audit", href: "/admin/audit", icon: "list", match: ["/admin/audit"], permission: "audit.read" },
          { id: "admin.tenant", label: "admin_tenant", href: "/admin/settings/tenant", icon: "settings", match: ["/admin/settings/tenant"], permission: "tenant.*" },
        ],
      },
      {
        id: "docs",
        label: "docs",
        href: "/docs",
        icon: "docs",
        match: ["/docs"],
        children: [
          { id: "docs.overview", label: "docs_overview", href: "/docs", icon: "docs", match: ["/docs"] },
          { id: "docs.business", label: "docs_business", href: "/docs/business", icon: "briefcase", match: ["/docs/business"] },
          { id: "docs.saas", label: "docs_saas", href: "/docs/saas", icon: "business", match: ["/docs/saas"] },
          { id: "docs.developer", label: "docs_developer", href: "/docs/developer", icon: "office", match: ["/docs/developer"] },
          { id: "docs.backlog", label: "docs_backlog", href: "/docs/backlog", icon: "list", match: ["/docs/backlog"] },
          { id: "docs.user", label: "docs_user", href: "/docs/user", icon: "guide", match: ["/docs/user"] },
          { id: "docs.test", label: "docs_test", href: "/docs/test", icon: "test", match: ["/docs/test"] },
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
    label: "people",
    icon: "customer",
    href: "/people",
    match: ["/people"],
    children: [
      { id: "people.home", label: "people_home", href: "/people", icon: "me", match: ["/people"] },
      { id: "people.leave", label: "people_leave", href: "/people/leave", icon: "calendar", match: ["/people/leave"] },
      {
        id: "people.team.availability",
        label: "people_team_availability",
        href: "/people/team/availability",
        icon: "customer",
        match: ["/people/team/availability"],
        permission: "people.team.availability.read",
      },
      // PE-02 — Attendance & Correction. Self-service view + "báo sai" — reuses
      // the same ApprovalTask queue as leave, no second approval mechanism.
      { id: "people.attendance", label: "people_attendance", href: "/people/attendance", icon: "calendar", match: ["/people/attendance"], permission: "people.self.attendance.read" },
      // HR-only: file import engine (SME Lite — attendanceMode=FILE_IMPORT).
      { id: "people.admin.import", label: "people_admin_import", href: "/people/admin/import", icon: "office", match: ["/people/admin/import"], permission: "people.hr.import.manage" },
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
    label: "platform",
    icon: "business",
    href: "/platform",
    match: ["/platform"],
    permission: "platform.tenant.read",
    group: "platform",
    children: [
      { id: "platform.overview", label: "platform_overview", href: "/platform", icon: "chart", match: ["/platform"], permission: "platform.tenant.read" },
      { id: "platform.tenants", label: "platform_tenants", href: "/platform/tenants", icon: "business", match: ["/platform/tenants"], permission: "platform.tenant.read" },
      { id: "platform.plans", label: "platform_plans", href: "/platform/plans", icon: "apps", match: ["/platform/plans"], permission: "platform.tenant.read" },
      { id: "platform.readiness", label: "platform_readiness", href: "/platform/readiness", icon: "chart", match: ["/platform/readiness"], permission: "platform.tenant.read" },
      { id: "platform.launches", label: "platform_launches", href: "/platform/launches", icon: "office", match: ["/platform/launches"], permission: "platform.launch.read" },
      { id: "platform.blueprints", label: "platform_blueprints", href: "/platform/blueprints", icon: "office", match: ["/platform/blueprints"], permission: "platform.blueprint.read" },
      { id: "platform.seed-packs", label: "platform_seed-packs", href: "/platform/seed-packs", icon: "office", match: ["/platform/seed-packs"], permission: "platform.blueprint.read" },
      { id: "platform.backups", label: "platform_backups", href: "/platform/backups", icon: "folder", match: ["/platform/backups"], permission: "platform.backup.read" },
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
    label: "delivery",
    icon: "briefcase",
    href: "/delivery",
    match: ["/delivery"],
    permission: "delivery.read",
    group: "platform",
    children: [
      { id: "delivery.overview", label: "delivery_overview", href: "/delivery", icon: "chart", match: ["/delivery"], permission: "delivery.read" },
      { id: "delivery.engagements", label: "delivery_engagements", href: "/delivery/engagements", icon: "briefcase", match: ["/delivery/engagements"], permission: "delivery.read" },
    ],
  },
  // -----------------------------------------------------------------------------
  // ENGINEERING GOVERNANCE workspace (DG-01, 2026-08-05) — Product/Version
  // registry for the whole ecosystem (XHub/X.Office/X2/X1/FinERP/X.Space).
  // Platform-only concern (see docs/implementation/engineering-hub/ADR_*.md),
  // pinned alongside platform/delivery. Gated by `engineering.product.read`
  // (nav-visibility only — the backend read routes are intentionally open;
  // this just hides the workspace from normal tenant users). Does NOT
  // rename/replace the existing "Tài liệu & Kiểm thử" nav group — that
  // migration is DG-04, not this pass.
  // -----------------------------------------------------------------------------
  {
    id: "engineering",
    label: "engineering",
    icon: "office",
    href: "/engineering",
    match: ["/engineering"],
    permission: "engineering.product.read",
    group: "platform",
    children: [
      { id: "engineering.overview", label: "engineering_overview", href: "/engineering", icon: "chart", match: ["/engineering"], permission: "engineering.product.read" },
      { id: "engineering.products", label: "engineering_products", href: "/engineering/products", icon: "business", match: ["/engineering/products"], permission: "engineering.product.read" },
      { id: "engineering.versions", label: "engineering_versions", href: "/engineering/versions", icon: "list", match: ["/engineering/versions"], permission: "engineering.product.read" },
      { id: "engineering.backlog", label: "engineering_backlog", href: "/engineering/backlog", icon: "list", match: ["/engineering/backlog"], permission: "engineering.product.read" },
      { id: "engineering.docs", label: "engineering_docs", href: "/engineering/docs", icon: "docs", match: ["/engineering/docs"], permission: "engineering.product.read" },
      { id: "engineering.tests", label: "engineering_tests", href: "/engineering/tests", icon: "test", match: ["/engineering/tests"], permission: "engineering.product.read" },
      { id: "engineering.defects", label: "engineering_defects", href: "/engineering/defects", icon: "alert", match: ["/engineering/defects"], permission: "engineering.product.read" },
      { id: "engineering.controls", label: "engineering_controls", href: "/engineering/controls", icon: "list", match: ["/engineering/controls"], permission: "engineering.product.read" },
      { id: "engineering.ai-systems", label: "engineering_ai-systems", href: "/engineering/ai-systems", icon: "chart", match: ["/engineering/ai-systems"], permission: "engineering.product.read" },
      { id: "engineering.privacy", label: "engineering_privacy", href: "/engineering/privacy", icon: "docs", match: ["/engineering/privacy"], permission: "engineering.product.read" },
      { id: "engineering.audit-room", label: "engineering_audit-room", href: "/engineering/audit-room", icon: "briefcase", match: ["/engineering/audit-room"], permission: "engineering.product.read" },
    ],
  },
];
