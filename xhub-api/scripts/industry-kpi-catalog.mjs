// X.Office Management Operating System — INDUSTRY KPI/OKR CATALOG.
//
// Single source of truth for INDUSTRY-APPROPRIATE management content (Strategic
// objectives / KPI definitions / OKR cycle) per demo tenant. Consumed by
// scripts/seed-manage-industries.mjs and scripts/manage-industry-smoke.mjs.
//
// Design rules (constitution):
//  #3/#9  Objective ≠ Metric ≠ OKR ≠ task — three separate lists, linked BY REFERENCE.
//  #5     Every metric carries owner + formula + source + frequency + direction
//         + baseline/target/thresholdAmber/thresholdRed. No exceptions.
//  #12    NO fake connectors. `XOFFICE_WORK` is the ONLY real connector today, so
//         exactly ONE metric (ACT-CLOSE, injected universally by UNIVERSAL_METRIC)
//         uses it. Every industry metric is honestly marked sourceSystem=MANUAL —
//         the numbers are entered by the metric owner, not "live computed".
//
// No new Prisma tables: this is plain data mapped onto StrategicObjective /
// MetricDefinition / MetricObservation / Scorecard / OKRCycle / OKRObjective /
// KeyResult exactly as they exist in prisma/schema.prisma.

/** Perspective strings — identical to the shipped T001 slice (seed-manage.mjs). */
export const P = {
  FINANCIAL: 'Financial/Value',
  CUSTOMER: 'Customer',
  PROCESS: 'Internal Process',
  CAPABILITY: 'Learning/Capability',
};

/**
 * The ONE genuinely computed metric (XOFFICE_WORK connector), shared by every
 * industry — commitment completion is cross-industry and it is the only KPI with
 * a real backing system. Attached to each industry's PROCESS objective.
 */
export const UNIVERSAL_METRIC = {
  code: 'ACT-CLOSE',
  name: 'Tỷ lệ cam kết hoàn thành đúng hạn',
  formula: 'share of NativeWorkItem with dueAt that are not overdue (status not DONE/CANCELLED, dueAt >= now)',
  unit: '%',
  direction: 'UP',
  sourceSystem: 'XOFFICE_WORK',
  frequency: 'WEEKLY',
  baseline: 72,
  target: 90,
  thresholdAmber: 80,
  thresholdRed: 70,
  universal: true,
};

// Shorthand builder — keeps each industry row readable while still forcing #5.
const m = (code, name, unit, direction, frequency, baseline, target, amber, red, formula) => ({
  code, name, unit, direction, frequency, baseline, target,
  thresholdAmber: amber, thresholdRed: red,
  sourceSystem: 'MANUAL', // #12 — no connector exists for these yet, say so.
  formula,
});

/**
 * INDUSTRIES — keyed by industry code.
 * Each entry:
 *   label       Vietnamese industry label
 *   objectives  exactly 4, perspective-balanced (FINANCIAL/CUSTOMER/PROCESS/CAPABILITY)
 *   metrics     2-4 per objective, keyed to the objective code via `objective`
 *   okr         1 cycle × 2 objectives × 2 key results
 */
export const INDUSTRIES = {
  // ---------------------------------------------------------------- T001 ----
  // X-TECH — the reference/default entry. Already shipped by seed:manage +
  // seed:manage-okr; listed here for consistency and reused as the fallback.
  // NEVER re-seeded by seed-manage-industries.mjs (see `reference: true`).
  TECH: {
    label: 'Công nghệ / phần mềm doanh nghiệp',
    reference: true,
    objectives: [
      { code: 'ST-GROWTH', name: 'Tăng trưởng bền vững', perspective: P.FINANCIAL, status: 'ACTIVE' },
      { code: 'ST-CUSTOMER', name: 'Trải nghiệm khách hàng liền mạch', perspective: P.CUSTOMER, status: 'ACTIVE' },
      { code: 'ST-OPS', name: 'Vận hành nhanh, chuẩn và có thể dự báo', perspective: P.PROCESS, status: 'AT_RISK' },
      { code: 'ST-CAP', name: 'Năng lực số, dữ liệu và AI', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [],
    okr: null,
  },

  // ---------------------------------------------------------------- T002 ----
  REAL_ESTATE: {
    label: 'Chủ đầu tư và phát triển bất động sản',
    objectives: [
      { code: 'ST-RE-SALES', name: 'Tăng tốc hấp thụ rổ hàng và dòng tiền bán hàng', perspective: P.FINANCIAL, status: 'ACTIVE' },
      { code: 'ST-RE-CUST', name: 'Bàn giao đúng cam kết, giữ uy tín với khách mua', perspective: P.CUSTOMER, status: 'ACTIVE' },
      { code: 'ST-RE-PROJ', name: 'Kiểm soát tiến độ và pháp lý dự án', perspective: P.PROCESS, status: 'AT_RISK' },
      { code: 'ST-RE-CAP', name: 'Nâng năng lực đội ngũ kinh doanh và dữ liệu thị trường', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('RE-ABSORB', 'Tỷ lệ hấp thụ rổ hàng theo tháng', '%', 'UP', 'MONTHLY', 42, 65, 55, 45, 'sold units / released units in period (nhập tay từ báo cáo bán hàng)'),
      m('RE-COLLECT', 'Tỷ lệ thu tiền theo tiến độ hợp đồng', '%', 'UP', 'MONTHLY', 78, 95, 88, 80, 'collected amount / amount due per contract schedule (nhập tay)'),
      m('RE-HANDOVER-OT', 'Tỷ lệ căn bàn giao đúng hạn', '%', 'UP', 'MONTHLY', 74, 95, 88, 80, 'units handed over on/before committed date / units due (nhập tay)'),
      m('RE-COMPLAINT', 'Số khiếu nại khách mua trên 100 căn bàn giao', 'cases/100', 'DOWN', 'MONTHLY', 9, 3, 5, 8, 'complaints / (handed-over units / 100) (nhập tay từ CSKH)'),
      m('RE-LEGAL-READY', 'Tỷ lệ hạng mục pháp lý hoàn tất đúng mốc', '%', 'UP', 'MONTHLY', 65, 90, 80, 70, 'legal milestones completed on time / milestones due (nhập tay)'),
      m('RE-COST-VAR', 'Sai lệch chi phí đầu tư so với ngân sách', '%', 'DOWN', 'MONTHLY', 8, 3, 5, 8, '(actual investment cost - budget) / budget (nhập tay từ ban QLDA)'),
      m('RE-AGENT-PROD', 'Doanh số bình quân mỗi chuyên viên kinh doanh', 'units/person', 'UP', 'MONTHLY', 1.1, 2.5, 1.8, 1.2, 'sold units / active sales headcount (nhập tay)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Bán hết rổ hàng đợt mở bán quý 3 mà không phá giá',
          confidence: 0.6, align: ['ST-RE-SALES', 'ST-RE-CAP'],
          keyResults: [
            { description: 'Nâng tỷ lệ hấp thụ rổ hàng đợt mở bán lên 65%', baseline: 42, target: 65, current: 51, unit: '%' },
            { description: 'Giữ mức chiết khấu bình quân dưới 4% giá niêm yết', baseline: 7, target: 4, current: 5.5, unit: '%' },
          ],
        },
        {
          key: 'o2', objective: 'Bàn giao block A đúng cam kết và sạch khiếu nại lớn',
          confidence: 0.5, align: ['ST-RE-CUST', 'ST-RE-PROJ'],
          keyResults: [
            { description: 'Tỷ lệ căn bàn giao đúng hạn đạt 95%', baseline: 74, target: 95, current: 82, unit: '%' },
            { description: 'Giảm khiếu nại khách mua còn 3 vụ/100 căn', baseline: 9, target: 3, current: 6, unit: 'cases/100' },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- T003 ----
  MANUFACTURING: {
    label: 'Sản xuất công nghiệp',
    objectives: [
      { code: 'ST-MFG-MARGIN', name: 'Cải thiện biên lợi nhuận sản xuất', perspective: P.FINANCIAL, status: 'ACTIVE' },
      { code: 'ST-MFG-CUST', name: 'Giao hàng đủ, đúng hạn cho khách công nghiệp', perspective: P.CUSTOMER, status: 'ACTIVE' },
      { code: 'ST-MFG-QUALITY', name: 'Giảm tỷ lệ lỗi sản xuất và phế phẩm', perspective: P.PROCESS, status: 'AT_RISK' },
      { code: 'ST-MFG-OEE', name: 'Tối ưu OEE thiết bị và năng lực bảo trì', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('MFG-COGS', 'Giá thành đơn vị sản phẩm', 'VND/unit', 'DOWN', 'MONTHLY', 128000, 112000, 120000, 128000, 'total production cost / good units produced (nhập tay từ kế toán giá thành)'),
      m('MFG-SCRAP-COST', 'Chi phí phế phẩm trên doanh thu', '%', 'DOWN', 'MONTHLY', 3.4, 1.5, 2.2, 3.0, 'scrap cost / net revenue (nhập tay)'),
      m('MFG-OTIF', 'Tỷ lệ giao hàng đúng hạn và đủ lượng (OTIF)', '%', 'UP', 'WEEKLY', 86, 97, 93, 88, 'orders delivered on time and in full / total orders (nhập tay từ kho vận)'),
      m('MFG-DEFECT', 'Tỷ lệ lỗi sản xuất (defect rate)', 'ppm', 'DOWN', 'WEEKLY', 4200, 1500, 2500, 3500, 'defective units / total units produced × 1,000,000 (nhập tay từ QC)'),
      m('MFG-REWORK', 'Tỷ lệ hàng phải làm lại (rework)', '%', 'DOWN', 'WEEKLY', 6.1, 2.5, 4.0, 5.5, 'reworked units / total units produced (nhập tay từ QC)'),
      m('MFG-OEE', 'Hiệu suất thiết bị tổng thể (OEE)', '%', 'UP', 'WEEKLY', 62, 80, 72, 65, 'availability × performance × quality (nhập tay từ nhật ký chuyền)'),
      m('MFG-MTBF', 'Thời gian trung bình giữa hai lần dừng máy (MTBF)', 'hours', 'UP', 'MONTHLY', 120, 260, 180, 140, 'total run hours / number of breakdowns (nhập tay từ bảo trì)'),
      m('MFG-SAFETY', 'Số sự cố an toàn lao động ghi nhận', 'cases', 'DOWN', 'MONTHLY', 4, 0, 1, 3, 'recordable safety incidents in period (nhập tay từ HSE)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Đưa chất lượng chuyền chính về chuẩn khách hàng OEM',
          confidence: 0.55, align: ['ST-MFG-QUALITY', 'ST-MFG-CUST'],
          keyResults: [
            { description: 'Giảm tỷ lệ lỗi sản xuất chuyền 1 xuống 1.500 ppm', baseline: 4200, target: 1500, current: 3100, unit: 'ppm' },
            { description: 'Giảm tỷ lệ hàng phải làm lại còn 2.5%', baseline: 6.1, target: 2.5, current: 4.4, unit: '%' },
          ],
        },
        {
          key: 'o2', objective: 'Nâng OEE toàn nhà máy lên chuẩn world-class nhóm 2',
          confidence: 0.5, align: ['ST-MFG-OEE', 'ST-MFG-MARGIN'],
          keyResults: [
            { description: 'Nâng OEE bình quân 3 chuyền lên 80%', baseline: 62, target: 80, current: 68, unit: '%' },
            { description: 'Nâng MTBF thiết bị trọng yếu lên 260 giờ', baseline: 120, target: 260, current: 175, unit: 'hours' },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- T004 ----
  DISTRIBUTION: {
    label: 'Phân phối và bán lẻ',
    objectives: [
      { code: 'ST-DIST-GM', name: 'Tăng lợi nhuận gộp trên mỗi điểm bán', perspective: P.FINANCIAL, status: 'ACTIVE' },
      { code: 'ST-DIST-CAC', name: 'Giảm chi phí thu hút khách hàng và tăng giữ chân', perspective: P.CUSTOMER, status: 'AT_RISK' },
      { code: 'ST-DIST-INV', name: 'Tăng vòng quay tồn kho, giảm hàng chết', perspective: P.PROCESS, status: 'ACTIVE' },
      { code: 'ST-DIST-CAP', name: 'Chuẩn hóa năng lực đội bán hàng và dữ liệu điểm bán', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('DIST-GM', 'Biên lợi nhuận gộp', '%', 'UP', 'MONTHLY', 18.5, 24, 21, 19, 'gross profit / net revenue (nhập tay từ kế toán)'),
      m('DIST-SPD', 'Doanh thu bình quân mỗi điểm bán mỗi ngày', 'VND/day', 'UP', 'MONTHLY', 6200000, 9000000, 7500000, 6500000, 'net revenue / (active outlets × selling days) (nhập tay)'),
      m('DIST-CAC', 'Chi phí thu hút một khách hàng mới (CAC)', 'VND/customer', 'DOWN', 'MONTHLY', 320000, 180000, 240000, 300000, 'sales & marketing spend / new customers acquired (nhập tay)'),
      m('DIST-RETENTION', 'Tỷ lệ khách hàng mua lại trong 90 ngày', '%', 'UP', 'MONTHLY', 34, 55, 45, 36, 'customers repurchasing within 90 days / active customers (nhập tay)'),
      m('DIST-TURNS', 'Vòng quay tồn kho', 'turns/year', 'UP', 'MONTHLY', 5.2, 9, 7, 5.5, 'COGS / average inventory value, annualised (nhập tay từ kho)'),
      m('DIST-DEADSTOCK', 'Tỷ lệ hàng tồn chậm luân chuyển trên 90 ngày', '%', 'DOWN', 'MONTHLY', 14, 5, 8, 12, 'value of SKUs unsold > 90 days / total inventory value (nhập tay)'),
      m('DIST-OOS', 'Tỷ lệ hết hàng tại điểm bán (out-of-stock)', '%', 'DOWN', 'WEEKLY', 9.5, 3, 5, 8, 'SKU-outlet out-of-stock checks / total checks (nhập tay từ giám sát bán hàng)'),
      m('DIST-COVERAGE', 'Tỷ lệ điểm bán được viếng thăm đúng tuyến', '%', 'UP', 'WEEKLY', 71, 92, 85, 75, 'visited outlets on route / planned outlets (nhập tay từ đội bán hàng)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Giải phóng vốn kẹt trong tồn kho mà không mất doanh số',
          confidence: 0.55, align: ['ST-DIST-INV', 'ST-DIST-GM'],
          keyResults: [
            { description: 'Nâng vòng quay tồn kho lên 9 vòng/năm', baseline: 5.2, target: 9, current: 6.4, unit: 'turns/year' },
            { description: 'Giảm tỷ lệ hàng tồn chậm trên 90 ngày còn 5%', baseline: 14, target: 5, current: 10, unit: '%' },
          ],
        },
        {
          key: 'o2', objective: 'Mua khách rẻ hơn và giữ khách lâu hơn',
          confidence: 0.45, align: ['ST-DIST-CAC'],
          keyResults: [
            { description: 'Giảm CAC xuống 180.000đ/khách mới', baseline: 320000, target: 180000, current: 265000, unit: 'VND/customer' },
            { description: 'Nâng tỷ lệ mua lại trong 90 ngày lên 55%', baseline: 34, target: 55, current: 41, unit: '%' },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- T005 ----
  CONSTRUCTION: {
    label: 'Xây dựng và tổng thầu',
    objectives: [
      { code: 'ST-CON-MARGIN', name: 'Bảo vệ biên lợi nhuận hợp đồng thi công', perspective: P.FINANCIAL, status: 'AT_RISK' },
      { code: 'ST-CON-DELIVERY', name: 'Đúng tiến độ bàn giao cho chủ đầu tư', perspective: P.CUSTOMER, status: 'ACTIVE' },
      { code: 'ST-CON-COST', name: 'Kiểm soát chi phí vật tư và thất thoát công trường', perspective: P.PROCESS, status: 'ACTIVE' },
      { code: 'ST-CON-HSE', name: 'Nâng năng lực an toàn và chất lượng thi công', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('CON-GM', 'Biên lợi nhuận gộp hợp đồng', '%', 'UP', 'MONTHLY', 8.2, 13, 10.5, 9, 'contract gross profit / contract revenue recognised (nhập tay từ ban kinh tế)'),
      m('CON-CASHFLOW', 'Tỷ lệ nghiệm thu thanh toán đúng kỳ', '%', 'UP', 'MONTHLY', 68, 90, 82, 72, 'approved payment applications / submitted applications (nhập tay)'),
      m('CON-SPI', 'Chỉ số tiến độ dự án (SPI)', 'ratio', 'UP', 'WEEKLY', 0.88, 1.0, 0.95, 0.9, 'earned value / planned value (nhập tay từ ban chỉ huy công trường)'),
      m('CON-MILESTONE', 'Tỷ lệ mốc bàn giao đúng hạn', '%', 'UP', 'MONTHLY', 72, 95, 88, 78, 'milestones handed over on time / milestones due (nhập tay)'),
      m('CON-MAT-WASTE', 'Tỷ lệ hao hụt vật tư chính', '%', 'DOWN', 'MONTHLY', 6.8, 3, 4.5, 6, '(issued material - as-built quantity) / issued material (nhập tay từ kho công trường)'),
      m('CON-CPI', 'Chỉ số chi phí dự án (CPI)', 'ratio', 'UP', 'MONTHLY', 0.91, 1.0, 0.96, 0.92, 'earned value / actual cost (nhập tay)'),
      m('CON-LTIFR', 'Tần suất tai nạn lao động mất ngày công (LTIFR)', 'per 1M hours', 'DOWN', 'MONTHLY', 3.1, 0.5, 1.5, 2.5, 'lost-time injuries × 1,000,000 / worked hours (nhập tay từ HSE)'),
      m('CON-NCR', 'Số phiếu không phù hợp chất lượng (NCR) mở', 'cases', 'DOWN', 'MONTHLY', 22, 5, 12, 18, 'open non-conformance reports at period end (nhập tay từ QA/QC)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Đưa gói thầu trọng điểm về đúng đường tiến độ cam kết',
          confidence: 0.5, align: ['ST-CON-DELIVERY', 'ST-CON-MARGIN'],
          keyResults: [
            { description: 'Nâng SPI gói thầu trọng điểm lên 1.0', baseline: 0.88, target: 1.0, current: 0.93, unit: 'ratio' },
            { description: 'Nâng tỷ lệ mốc bàn giao đúng hạn lên 95%', baseline: 72, target: 95, current: 84, unit: '%' },
          ],
        },
        {
          key: 'o2', objective: 'Chặn thất thoát vật tư và tai nạn trên toàn bộ công trường',
          confidence: 0.6, align: ['ST-CON-COST', 'ST-CON-HSE'],
          keyResults: [
            { description: 'Giảm hao hụt vật tư chính còn 3%', baseline: 6.8, target: 3, current: 5.1, unit: '%' },
            { description: 'Giảm LTIFR xuống 0.5 vụ/1 triệu giờ công', baseline: 3.1, target: 0.5, current: 1.8, unit: 'per 1M hours' },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- T006 ----
  HOSPITALITY: {
    label: 'Khách sạn, nghỉ dưỡng và dịch vụ',
    objectives: [
      { code: 'ST-HOS-REVPAR', name: 'Tăng doanh thu trên mỗi phòng sẵn có (RevPAR)', perspective: P.FINANCIAL, status: 'ACTIVE' },
      { code: 'ST-HOS-GUEST', name: 'Nâng điểm hài lòng khách lưu trú', perspective: P.CUSTOMER, status: 'ACTIVE' },
      { code: 'ST-HOS-OCC', name: 'Tối ưu tỷ lệ lấp đầy phòng theo mùa vụ', perspective: P.PROCESS, status: 'AT_RISK' },
      { code: 'ST-HOS-CAP', name: 'Giữ chân và nâng tay nghề đội ngũ dịch vụ', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('HOS-REVPAR', 'Doanh thu trên mỗi phòng sẵn có (RevPAR)', 'VND/room-night', 'UP', 'WEEKLY', 780000, 1150000, 950000, 820000, 'room revenue / available room-nights (nhập tay từ PMS)'),
      m('HOS-ADR', 'Giá phòng bình quân (ADR)', 'VND/room-night', 'UP', 'WEEKLY', 1250000, 1600000, 1400000, 1280000, 'room revenue / sold room-nights (nhập tay từ PMS)'),
      m('HOS-CSAT', 'Điểm hài lòng khách hàng (CSAT)', 'points', 'UP', 'MONTHLY', 7.9, 9.2, 8.6, 8.0, 'average guest satisfaction score 0-10 (nhập tay từ khảo sát sau lưu trú)'),
      m('HOS-COMPLAINT-TTR', 'Thời gian xử lý phàn nàn của khách', 'hours', 'DOWN', 'WEEKLY', 14, 4, 8, 12, 'average hours from complaint logged to resolved (nhập tay từ lễ tân)'),
      m('HOS-OCC', 'Tỷ lệ lấp đầy phòng', '%', 'UP', 'WEEKLY', 61, 82, 74, 65, 'sold room-nights / available room-nights (nhập tay từ PMS)'),
      m('HOS-FNB-CAPTURE', 'Tỷ lệ khách lưu trú sử dụng dịch vụ F&B', '%', 'UP', 'MONTHLY', 38, 60, 50, 42, 'guests with an F&B check / in-house guests (nhập tay)'),
      m('HOS-TURNOVER', 'Tỷ lệ nghỉ việc nhân sự dịch vụ', '%', 'DOWN', 'MONTHLY', 4.5, 2, 3, 4, 'leavers in period / average service headcount (nhập tay từ HR)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Lấp đầy phòng mùa thấp điểm mà vẫn giữ giá',
          confidence: 0.5, align: ['ST-HOS-OCC', 'ST-HOS-REVPAR'],
          keyResults: [
            { description: 'Nâng tỷ lệ lấp đầy phòng bình quân lên 82%', baseline: 61, target: 82, current: 70, unit: '%' },
            { description: 'Giữ ADR không dưới 1.600.000đ/đêm', baseline: 1250000, target: 1600000, current: 1420000, unit: 'VND/room-night' },
          ],
        },
        {
          key: 'o2', objective: 'Biến trải nghiệm lưu trú thành lý do khách quay lại',
          confidence: 0.6, align: ['ST-HOS-GUEST', 'ST-HOS-CAP'],
          keyResults: [
            { description: 'Nâng điểm hài lòng khách hàng lên 9.2/10', baseline: 7.9, target: 9.2, current: 8.4, unit: 'points' },
            { description: 'Giảm thời gian xử lý phàn nàn còn 4 giờ', baseline: 14, target: 4, current: 9, unit: 'hours' },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- T007 ----
  EDUCATION: {
    label: 'Giáo dục và đào tạo',
    objectives: [
      { code: 'ST-EDU-ENROLL', name: 'Tăng tuyển sinh và doanh thu học phí bền vững', perspective: P.FINANCIAL, status: 'ACTIVE' },
      { code: 'ST-EDU-OUTCOME', name: 'Nâng tỷ lệ hoàn thành khóa học và kết quả người học', perspective: P.CUSTOMER, status: 'AT_RISK' },
      { code: 'ST-EDU-OPS', name: 'Vận hành lớp học và lịch giảng dạy ổn định', perspective: P.PROCESS, status: 'ACTIVE' },
      { code: 'ST-EDU-FACULTY', name: 'Nâng chất lượng và điểm đánh giá giảng viên', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('EDU-ENROLL', 'Số học viên nhập học mới trong kỳ', 'students', 'UP', 'MONTHLY', 320, 500, 420, 350, 'new enrolled students in period (nhập tay từ phòng tuyển sinh)'),
      m('EDU-TUITION-COLLECT', 'Tỷ lệ thu học phí đúng hạn', '%', 'UP', 'MONTHLY', 82, 96, 90, 84, 'tuition collected on time / tuition due (nhập tay từ kế toán)'),
      m('EDU-COMPLETION', 'Tỷ lệ hoàn thành khóa học', '%', 'UP', 'MONTHLY', 68, 88, 80, 72, 'students completing / students enrolled in cohort (nhập tay từ phòng đào tạo)'),
      m('EDU-DROPOUT', 'Tỷ lệ bỏ học giữa khóa', '%', 'DOWN', 'MONTHLY', 17, 6, 10, 14, 'students dropping out / students enrolled (nhập tay)'),
      m('EDU-ATTENDANCE', 'Tỷ lệ chuyên cần bình quân', '%', 'UP', 'WEEKLY', 79, 93, 87, 81, 'attended sessions / scheduled sessions (nhập tay từ điểm danh)'),
      m('EDU-CLASS-FILL', 'Tỷ lệ lấp đầy lớp học', '%', 'UP', 'MONTHLY', 66, 85, 76, 68, 'enrolled seats / planned seats (nhập tay)'),
      m('EDU-TEACHER-SCORE', 'Điểm đánh giá giảng viên từ người học', 'points', 'UP', 'MONTHLY', 4.0, 4.7, 4.4, 4.1, 'average instructor rating 1-5 from end-of-course survey (nhập tay)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Giữ được người học đã tuyển tới ngày tốt nghiệp',
          confidence: 0.5, align: ['ST-EDU-OUTCOME', 'ST-EDU-OPS'],
          keyResults: [
            { description: 'Nâng tỷ lệ hoàn thành khóa học lên 88%', baseline: 68, target: 88, current: 75, unit: '%' },
            { description: 'Giảm tỷ lệ bỏ học giữa khóa còn 6%', baseline: 17, target: 6, current: 12, unit: '%' },
          ],
        },
        {
          key: 'o2', objective: 'Chuẩn hóa chất lượng giảng dạy toàn hệ thống',
          confidence: 0.6, align: ['ST-EDU-FACULTY', 'ST-EDU-ENROLL'],
          keyResults: [
            { description: 'Nâng điểm đánh giá giảng viên bình quân lên 4.7/5', baseline: 4.0, target: 4.7, current: 4.3, unit: 'points' },
            { description: 'Nâng tỷ lệ chuyên cần bình quân lên 93%', baseline: 79, target: 93, current: 85, unit: '%' },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- T008 ----
  // Administrative / operational only — NO clinical or PHI metrics (noPhi demo).
  HEALTHCARE: {
    label: 'Y tế và chăm sóc sức khỏe (hành chính)',
    objectives: [
      { code: 'ST-HC-FIN', name: 'Cân đối thu chi và thanh quyết toán bảo hiểm', perspective: P.FINANCIAL, status: 'ACTIVE' },
      { code: 'ST-HC-WAIT', name: 'Giảm thời gian chờ khám của người bệnh', perspective: P.CUSTOMER, status: 'AT_RISK' },
      { code: 'ST-HC-SAFETY', name: 'Tuân thủ an toàn người bệnh và quy trình', perspective: P.PROCESS, status: 'ACTIVE' },
      { code: 'ST-HC-CAP', name: 'Đủ nhân lực và năng lực chuyên môn theo ca', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('HC-CLAIM-DAYS', 'Số ngày thu hồi công nợ bảo hiểm y tế', 'days', 'DOWN', 'MONTHLY', 62, 30, 42, 55, 'average days from claim submitted to payment received (nhập tay từ phòng tài chính)'),
      m('HC-CLAIM-REJECT', 'Tỷ lệ hồ sơ bảo hiểm bị từ chối', '%', 'DOWN', 'MONTHLY', 11, 4, 7, 10, 'rejected claims / submitted claims (nhập tay)'),
      m('HC-WAIT-TIME', 'Thời gian chờ khám trung bình', 'minutes', 'DOWN', 'WEEKLY', 48, 20, 30, 40, 'average minutes from check-in to consultation start (nhập tay từ tiếp đón)'),
      m('HC-PATIENT-CSAT', 'Điểm hài lòng người bệnh', 'points', 'UP', 'MONTHLY', 7.6, 9.0, 8.4, 7.8, 'average patient satisfaction score 0-10 (nhập tay từ khảo sát)'),
      m('HC-SAFETY-COMPLY', 'Tỷ lệ tuân thủ checklist an toàn người bệnh', '%', 'UP', 'WEEKLY', 84, 98, 93, 88, 'checklists completed correctly / checklists required (nhập tay từ điều dưỡng trưởng)'),
      m('HC-INCIDENT', 'Số sự cố y khoa hành chính được ghi nhận', 'cases', 'DOWN', 'MONTHLY', 7, 1, 3, 6, 'recorded administrative incidents in period (nhập tay từ phòng QLCL)'),
      m('HC-SHIFT-COVER', 'Tỷ lệ ca trực được phủ đủ nhân lực', '%', 'UP', 'WEEKLY', 88, 99, 95, 90, 'fully staffed shifts / planned shifts (nhập tay từ phòng TCCB)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Rút ngắn hành trình chờ đợi của người bệnh ngoại trú',
          confidence: 0.5, align: ['ST-HC-WAIT', 'ST-HC-CAP'],
          keyResults: [
            { description: 'Giảm thời gian chờ khám trung bình còn 20 phút', baseline: 48, target: 20, current: 34, unit: 'minutes' },
            { description: 'Nâng điểm hài lòng người bệnh lên 9.0/10', baseline: 7.6, target: 9.0, current: 8.2, unit: 'points' },
          ],
        },
        {
          key: 'o2', objective: 'Không để sai sót quy trình lọt qua ca trực nào',
          confidence: 0.55, align: ['ST-HC-SAFETY', 'ST-HC-FIN'],
          keyResults: [
            { description: 'Nâng tuân thủ checklist an toàn người bệnh lên 98%', baseline: 84, target: 98, current: 91, unit: '%' },
            { description: 'Giảm tỷ lệ hồ sơ bảo hiểm bị từ chối còn 4%', baseline: 11, target: 4, current: 7.5, unit: '%' },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- T009 ----
  LOGISTICS: {
    label: 'Logistics và vận tải',
    objectives: [
      { code: 'ST-LOG-COST', name: 'Tối ưu chi phí vận chuyển trên mỗi đơn hàng', perspective: P.FINANCIAL, status: 'AT_RISK' },
      { code: 'ST-LOG-OTIF', name: 'Giao hàng đúng hạn và đủ lượng (OTIF)', perspective: P.CUSTOMER, status: 'ACTIVE' },
      { code: 'ST-LOG-FLEET', name: 'Nâng hiệu suất khai thác đội xe và kho bãi', perspective: P.PROCESS, status: 'ACTIVE' },
      { code: 'ST-LOG-CAP', name: 'Chuẩn hóa năng lực lái xe và an toàn hành trình', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('LOG-CPO', 'Chi phí vận chuyển bình quân mỗi đơn hàng', 'VND/order', 'DOWN', 'WEEKLY', 68000, 48000, 56000, 64000, 'total transport cost / delivered orders (nhập tay từ điều vận)'),
      m('LOG-FUEL', 'Mức tiêu hao nhiên liệu trên 100km', 'L/100km', 'DOWN', 'MONTHLY', 32, 26, 29, 31, 'fuel consumed / distance driven × 100 (nhập tay từ nhật trình xe)'),
      m('LOG-OTIF', 'Tỷ lệ giao hàng đúng hạn và đủ lượng (OTIF)', '%', 'UP', 'WEEKLY', 87, 97, 93, 89, 'orders delivered on time and in full / total orders (nhập tay từ TMS)'),
      m('LOG-DAMAGE', 'Tỷ lệ hàng hư hỏng/mất mát khi vận chuyển', '%', 'DOWN', 'MONTHLY', 1.8, 0.4, 0.9, 1.5, 'damaged or lost shipment value / total shipment value (nhập tay)'),
      m('LOG-FLEET-UTIL', 'Tỷ lệ khai thác đội xe', '%', 'UP', 'WEEKLY', 68, 88, 80, 72, 'vehicle running hours / available vehicle hours (nhập tay từ điều vận)'),
      m('LOG-EMPTY-KM', 'Tỷ lệ km chạy rỗng', '%', 'DOWN', 'WEEKLY', 26, 12, 18, 24, 'empty kilometres / total kilometres (nhập tay)'),
      m('LOG-DOCK-TIME', 'Thời gian quay đầu tại kho (dock turnaround)', 'minutes', 'DOWN', 'WEEKLY', 95, 45, 65, 85, 'average minutes from arrival to departure at dock (nhập tay từ kho)'),
      m('LOG-SAFETY', 'Số vụ tai nạn/vi phạm giao thông của đội xe', 'cases', 'DOWN', 'MONTHLY', 5, 0, 2, 4, 'traffic accidents or violations recorded in period (nhập tay từ ATGT)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Giao đúng hẹn cho khách hàng chủ lực trong mùa cao điểm',
          confidence: 0.55, align: ['ST-LOG-OTIF', 'ST-LOG-FLEET'],
          keyResults: [
            { description: 'Nâng OTIF toàn mạng lưới lên 97%', baseline: 87, target: 97, current: 91, unit: '%' },
            { description: 'Giảm thời gian quay đầu tại kho còn 45 phút', baseline: 95, target: 45, current: 68, unit: 'minutes' },
          ],
        },
        {
          key: 'o2', objective: 'Cắt chi phí mỗi chuyến mà không giảm chất lượng giao hàng',
          confidence: 0.45, align: ['ST-LOG-COST', 'ST-LOG-CAP'],
          keyResults: [
            { description: 'Giảm chi phí vận chuyển còn 48.000đ/đơn', baseline: 68000, target: 48000, current: 58000, unit: 'VND/order' },
            { description: 'Giảm tỷ lệ km chạy rỗng còn 12%', baseline: 26, target: 12, current: 19, unit: '%' },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- T010 ----
  PROFESSIONAL_SERVICES: {
    label: 'Tư vấn, luật, kiểm toán và dịch vụ chuyên nghiệp',
    objectives: [
      { code: 'ST-PS-REALIZE', name: 'Nâng doanh thu thực thu trên giờ tư vấn', perspective: P.FINANCIAL, status: 'ACTIVE' },
      { code: 'ST-PS-WIN', name: 'Tăng tỷ lệ thắng thầu và giữ khách hàng dài hạn', perspective: P.CUSTOMER, status: 'AT_RISK' },
      { code: 'ST-PS-UTIL', name: 'Tối ưu tỷ lệ utilization nhân sự chuyên môn', perspective: P.PROCESS, status: 'ACTIVE' },
      { code: 'ST-PS-CAP', name: 'Phát triển năng lực chuyên môn và giữ chân chuyên gia', perspective: P.CAPABILITY, status: 'ACTIVE' },
    ],
    metrics: [
      m('PS-REALIZATION', 'Tỷ lệ thực thu trên giá trị giờ ghi nhận (realization)', '%', 'UP', 'MONTHLY', 76, 92, 85, 78, 'billed amount / standard value of recorded hours (nhập tay từ hệ thống chấm giờ)'),
      m('PS-DSO', 'Số ngày thu hồi công nợ khách hàng (DSO)', 'days', 'DOWN', 'MONTHLY', 74, 40, 55, 68, 'accounts receivable / revenue × days in period (nhập tay từ kế toán)'),
      m('PS-WIN-RATE', 'Tỷ lệ thắng thầu / thắng đề xuất', '%', 'UP', 'MONTHLY', 28, 45, 37, 30, 'won proposals / submitted proposals (nhập tay từ phòng phát triển kinh doanh)'),
      m('PS-CLIENT-RETENTION', 'Tỷ lệ khách hàng tái ký hợp đồng', '%', 'UP', 'QUARTERLY', 71, 90, 82, 74, 'clients renewing / clients up for renewal (nhập tay)'),
      m('PS-UTILIZATION', 'Tỷ lệ utilization nhân sự chuyên môn', '%', 'UP', 'WEEKLY', 63, 80, 73, 66, 'billable hours / available hours (nhập tay từ timesheet)'),
      m('PS-PROJ-MARGIN', 'Biên lợi nhuận dự án tư vấn', '%', 'UP', 'MONTHLY', 22, 35, 29, 24, 'project revenue - delivery cost, over project revenue (nhập tay)'),
      m('PS-ATTRITION', 'Tỷ lệ nghỉ việc nhân sự chuyên môn', '%', 'DOWN', 'QUARTERLY', 15, 7, 10, 13, 'professional leavers / average professional headcount (nhập tay từ HR)'),
      m('PS-CPD', 'Số giờ đào tạo chuyên môn bình quân mỗi nhân sự', 'hours/person', 'UP', 'QUARTERLY', 8, 24, 16, 10, 'training hours delivered / professional headcount (nhập tay từ L&D)'),
    ],
    okr: {
      code: '2026Q3',
      objectives: [
        {
          key: 'o1', objective: 'Biến mỗi giờ chuyên môn thành doanh thu thực thu',
          confidence: 0.55, align: ['ST-PS-UTIL', 'ST-PS-REALIZE'],
          keyResults: [
            { description: 'Nâng utilization nhân sự chuyên môn lên 80%', baseline: 63, target: 80, current: 70, unit: '%' },
            { description: 'Nâng tỷ lệ thực thu (realization) lên 92%', baseline: 76, target: 92, current: 83, unit: '%' },
          ],
        },
        {
          key: 'o2', objective: 'Thắng nhiều hồ sơ hơn với chính đội ngũ hiện tại',
          confidence: 0.45, align: ['ST-PS-WIN', 'ST-PS-CAP'],
          keyResults: [
            { description: 'Nâng tỷ lệ thắng thầu lên 45%', baseline: 28, target: 45, current: 34, unit: '%' },
            { description: 'Nâng giờ đào tạo chuyên môn lên 24 giờ/người/quý', baseline: 8, target: 24, current: 14, unit: 'hours/person' },
          ],
        },
      ],
    },
  },
};

/**
 * tenantId → industry catalog key. Derived from scripts/demo-tenants.params.mjs
 * (kept explicit so a tenant can never silently fall back to the tech default).
 */
export const TENANT_INDUSTRY = {
  'tenant-xtech': 'TECH', // T001 — reference slice, seeded by seed:manage / seed:manage-okr
  'tenant-realestate-demo': 'REAL_ESTATE',
  'tenant-manufacturing-demo': 'MANUFACTURING',
  'tenant-distribution-demo': 'DISTRIBUTION',
  'tenant-construction-demo': 'CONSTRUCTION',
  'tenant-hospitality-demo': 'HOSPITALITY',
  'tenant-education-demo': 'EDUCATION',
  'tenant-healthcare-demo': 'HEALTHCARE',
  'tenant-logistics-demo': 'LOGISTICS',
  'tenant-professional-services-demo': 'PROFESSIONAL_SERVICES',
};

/** Resolve one industry entry for a tenantId. Throws on unknown tenants. */
export function industryFor(tenantId) {
  const key = TENANT_INDUSTRY[tenantId];
  if (!key) throw new Error(`no industry mapping for tenant "${tenantId}" (add it to TENANT_INDUSTRY)`);
  const entry = INDUSTRIES[key];
  if (!entry) throw new Error(`industry key "${key}" missing from INDUSTRIES`);
  return { key, ...entry };
}

/**
 * The industry's metrics PLUS the one universal XOFFICE_WORK metric, each already
 * bound to its objective. Industry metrics are distributed across the 4 objectives
 * in declaration order (FINANCIAL → CUSTOMER → PROCESS → CAPABILITY, 2 each);
 * ACT-CLOSE is always attached to the PROCESS objective.
 */
export function metricsWithObjective(entry) {
  const objs = entry.objectives;
  const per = Math.ceil(entry.metrics.length / objs.length) || 1;
  const out = entry.metrics.map((mt, i) => ({
    ...mt,
    objectiveCode: objs[Math.min(Math.floor(i / per), objs.length - 1)].code,
  }));
  const processObj = objs.find((o) => o.perspective === P.PROCESS) ?? objs[2];
  out.push({ ...UNIVERSAL_METRIC, objectiveCode: processObj.code });
  return out;
}

/** Tenants this catalog will actually seed (T001 is excluded — reference slice). */
export const SEEDABLE_TENANTS = Object.keys(TENANT_INDUSTRY).filter(
  (t) => !INDUSTRIES[TENANT_INDUSTRY[t]].reference,
);
