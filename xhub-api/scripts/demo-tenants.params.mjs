// Parameter table for the demo-tenant batch (SaaS step 6b) — the SINGLE source
// of truth that drives ONE parameter-driven provisioner (no per-tenant code
// branches, non-negotiable). Each row maps a reserved tenantNo → its registry
// identity + catalog blueprint/seed pack + the login-able demo employee person
// id seeded by that pack. Consumed by provision-tenant.mjs / provision-demo-
// tenants.mjs / demos-smoke.mjs. Blueprint/seed lookups are BY CODE (resolved to
// the latest PUBLISHED version by the catalog) — never hardcoded per key.
//
// T002 (real-estate) is listed for reference/lookup; the batch wrapper
// provisions T003–T010 (T002 keeps its own provision:t002 entrypoint).

export const DEMO_TENANTS = [
  { no: 2, id: 'tenant-realestate-demo', key: 'realestate-demo',
    name: 'Chủ đầu tư Bất động sản Demo', industry: 'Chủ đầu tư và phát triển bất động sản',
    tenantClass: 'VERTICAL_DEMO', planId: 'ENTERPRISE_VERTICAL_DEMO',
    blueprint: 'BP-RE-002', seedPack: 'SP-RE-DEMO', empId: 't002-re-agent-01' },

  { no: 3, id: 'tenant-manufacturing-demo', key: 'manufacturing-demo',
    name: 'Nhà máy Sản xuất Demo', industry: 'Sản xuất công nghiệp',
    tenantClass: 'VERTICAL_DEMO', planId: 'PROFESSIONAL_VERTICAL_DEMO',
    blueprint: 'BP-MFG-003', seedPack: 'SP-MFG-DEMO', empId: 't003-mfg-emp-01' },

  { no: 4, id: 'tenant-distribution-demo', key: 'distribution-demo',
    name: 'Nhà phân phối / Bán lẻ Demo', industry: 'Phân phối và bán lẻ',
    tenantClass: 'VERTICAL_DEMO', planId: 'PROFESSIONAL_VERTICAL_DEMO',
    blueprint: 'BP-DIST-004', seedPack: 'SP-DIST-DEMO', empId: 't004-dist-emp-01' },

  { no: 5, id: 'tenant-construction-demo', key: 'construction-demo',
    name: 'Tổng thầu Xây dựng Demo', industry: 'Xây dựng và tổng thầu',
    tenantClass: 'VERTICAL_DEMO', planId: 'PROFESSIONAL_VERTICAL_DEMO',
    blueprint: 'BP-CONST-005', seedPack: 'SP-CONST-DEMO', empId: 't005-const-emp-01' },

  { no: 6, id: 'tenant-hospitality-demo', key: 'hospitality-demo',
    name: 'Khách sạn / Dịch vụ Demo', industry: 'Khách sạn, nghỉ dưỡng và dịch vụ',
    tenantClass: 'VERTICAL_DEMO', planId: 'PROFESSIONAL_VERTICAL_DEMO',
    blueprint: 'BP-HOSP-006', seedPack: 'SP-HOSP-DEMO', empId: 't006-hosp-emp-01' },

  { no: 7, id: 'tenant-education-demo', key: 'education-demo',
    name: 'Tổ chức Giáo dục Demo', industry: 'Giáo dục và đào tạo',
    tenantClass: 'VERTICAL_DEMO', planId: 'PROFESSIONAL_VERTICAL_DEMO',
    blueprint: 'BP-EDU-007', seedPack: 'SP-EDU-DEMO', empId: 't007-edu-emp-01' },

  // T008 healthcare — ADMINISTRATIVE demo only (no clinical / PHI); ENTERPRISE tier.
  { no: 8, id: 'tenant-healthcare-demo', key: 'healthcare-demo',
    name: 'Cơ sở Y tế (hành chính) Demo', industry: 'Y tế và chăm sóc sức khỏe',
    tenantClass: 'VERTICAL_DEMO', planId: 'ENTERPRISE_VERTICAL_DEMO',
    blueprint: 'BP-HC-008', seedPack: 'SP-HC-DEMO', empId: 't008-hc-emp-01', noPhi: true },

  { no: 9, id: 'tenant-logistics-demo', key: 'logistics-demo',
    name: 'Công ty Logistics / Vận tải Demo', industry: 'Logistics và vận tải',
    tenantClass: 'VERTICAL_DEMO', planId: 'PROFESSIONAL_VERTICAL_DEMO',
    blueprint: 'BP-LOG-009', seedPack: 'SP-LOG-DEMO', empId: 't009-log-emp-01' },

  { no: 10, id: 'tenant-professional-services-demo', key: 'professional-services-demo',
    name: 'Dịch vụ Chuyên nghiệp Demo', industry: 'Tư vấn, luật, kiểm toán và dịch vụ chuyên nghiệp',
    tenantClass: 'VERTICAL_DEMO', planId: 'PROFESSIONAL_VERTICAL_DEMO',
    blueprint: 'BP-PS-010', seedPack: 'SP-PS-DEMO', empId: 't010-ps-emp-01' },
];

// The batch provisions the 8 verticals T003–T010 (T002 has provision:t002).
export const BATCH_TENANTS = DEMO_TENANTS.filter((t) => t.no >= 3);

/** Resolve one row by tenantNo | key | id. Throws if unknown. */
export function resolveTenant(sel) {
  const s = String(sel);
  const row = DEMO_TENANTS.find((t) => String(t.no) === s || t.key === s || t.id === s);
  if (!row) throw new Error(`unknown demo tenant selector "${sel}" (use tenantNo 2-10, key, or id)`);
  return row;
}
