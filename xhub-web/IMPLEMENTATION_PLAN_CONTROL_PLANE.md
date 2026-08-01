# Implementation Plan — Tenant Control Plane + MDM + Sync

_Docs-first · 2026-07-29 · đi kèm `CONTROL_PLANE_MDM_GAP_ANALYSIS.md`_
_Theo `docs/10_IMPLEMENTATION_ROADMAP.md` + acceptance `docs/11_ACCEPTANCE_GATES.md`_

> Kế hoạch triển khai (chưa code). Tôn trọng SoR: KHÔNG tái tạo master của FinERP/HR/Mattermost; XHub MDM chỉ shared master + tenant overlay. Mọi command có correlation/idempotency/audit; mọi tenant table có RLS; mọi master có version/lineage/visibility; AI chỉ suggestion + human confirm.

---

## 1. Phụ thuộc (làm trước, ngoài phạm vi bộ này)

| Phụ thuộc | Nguồn | Vì sao chặn |
|---|---|---|
| Identity/Org Core (OrgUnit/Position/RoleBinding/DataScope, PersonProfile UUID) | `IDENTITY_ORG_GAP_ANALYSIS.md` + ADR-014/015 | Provisioning role mapping + overlay owner/scope cần org chuẩn |
| RLS Postgres per-tenant | đang có agent khác thêm | Acceptance `docs/11` "tenant overlay không rò chéo"; CP-026 |
| Auth thật/OIDC hook | `auth.service.ts:47-58` (seam đã có) | Tenant context từ session (đã có), enforce authz còn soft |

Kế hoạch bên dưới GIẢ ĐỊNH 2 phụ thuộc đầu tiến hành song song; vertical slice mock phần chưa có.

---

## 2. Models đề xuất (Prisma — ánh xạ contracts)

Bổ sung vào `xhub-api/prisma/schema.prisma` (tất cả tenant-scoped table có `tenantId` + RLS; master table có `version`/`visibility`/lineage):

| Model | Ánh xạ contract | Ghi chú thiết kế |
|---|---|---|
| `IdentityAccount` | `identity-account.schema.json` | id bất biến, primaryEmail, status INVITED/ACTIVE/LOCKED/DEACTIVATED, `authenticationProvider` INTERNAL (nâng từ Membership hiện tại `schema.prisma:335`) |
| `ApplicationDefinition` | `data/application-catalog.json` | key/ownerSystem/provisioningMode/supports/userSoR (PLATFORM) |
| `TenantApplicationInstance` | matrix APP-02 | tenantId + mode + entitlement, KHÔNG secret thô (vault ref) |
| `AppAccountBinding` | `app-account-binding.schema.json` | externalUserId + status 6 trạng thái + lastSyncedAt |
| `AppRoleMapping` | matrix APP-04 | versioned; nâng từ role-bindings.json phẳng |
| `ProvisioningCommand` | `provisioning-command.schema.json` + `docs/08` | outbox: operation, correlationId, idempotencyKey, mappingVersion, expectedSourceVersion; theo mẫu `ConnectorCommand` (`schema.prisma:135`) + `CommandLog` (`312`) |
| `ProvisioningConflict` | matrix APP-06 | duplicate/missing role/stale; manual resolve; không auto-link |
| `MasterRecord` | `master-record.schema.json` | 5 entityType, visibility GLOBAL/SHARED/TENANT_PRIVATE/RESTRICTED, version, lineageRefs, qualityScore, status DRAFT/ACTIVE/MERGED/RETIRED |
| `SourceRecord` | `source-record.schema.json` | immutable; rawPayloadHash, matchedMasterId, matchConfidence |
| `TenantMasterOverlay` | `tenant-master-overlay.schema.json` | overlayData, privateTags, owner, visibilityWithinTenant ALL/SCOPED/PRIVATE, version |
| `MasterMergeDecision` | matrix MDM-06 | reviewer + audit; successor/mergedInto |
| `GeographyRef` | matrix REF-01…04 | Country/Province/District/Ward, effective date + successor; GLOBAL, không nhân bản per tenant |
| `MetadataTaxonomy` | matrix MDM-07 | scope PLATFORM/TENANT, version, lifecycle |
| `MasterDataImportJob` | `import-job.schema.json` | 10 status UPLOADED→…→COMPLETED, mappingVersion, metrics |
| `DataQualityIssue` | matrix MDM-08 | severity/owner/resolution |
| `TenantBackupScope` | `tenant-backup-scope.schema.json` | include/exclude, sharedMasterHandling 3 mode |

---

## 3. Endpoints đề xuất (BFF NestJS — module mới)

FE luôn qua BFF (`PROJECT_STATUS_XHUB.md` nguyên tắc). Module mới trong `xhub-api/src/`:

| Module | Endpoint (rút gọn) | Sprint |
|---|---|---|
| `control-plane/` | `GET/POST /api/tenants/:id/applications` (bật app), `/app-bindings`, `/app-role-mappings` | 1 |
| `provisioning/` | `POST /provisioning/commands` (idempotent), `/commands/:id/retry`, `GET /conflicts`, `POST /conflicts/:id/resolve`, `POST /memberships/:id/suspend` (impact preview) | 2 |
| `mdm/` | `GET/POST /mdm/master-records`, `/master-records/:id` (canonical+sources+overlays+history), `/overlays`, `/geography`, `/taxonomies`, `POST /merge-decisions` | 3 |
| `mdm-import/` | `POST /import-jobs` (dry-run), `/import-jobs/:id/stage|map|validate|match`, `GET /:id/duplicates`, `POST /duplicates/:id/decision`, `POST /:id/publish-batch`, `POST /:id/reconcile` | 4 |
| `backup/` | `POST /tenants/:id/backup` (scope), `/restore` (sandbox, remap identity), `POST /platform/shared-backup` | 5 |
| `identity/` (nâng auth) | nâng `Membership`→`IdentityAccount`, giữ `/api/auth/*` hiện có (`auth.controller.ts`) | 1 |

---

## 4. Vertical slice (làm mỏng-xuyên-suốt, mock phần chưa có)

Gộp 2 slice trong `docs/10:58-83` thành 1 chuỗi demo:

```
A. Bật app cho tenant X-TECH (TenantApplicationInstance: xoffice NATIVE, xspace MOCK)
   → provision 1 user sang xspace mock (ProvisioningCommand idempotent → AppAccountBinding ACTIVE + externalUserId)
   → suspend membership → impact preview (khóa xoffice, deactivate xspace) → verify audit + isolation
B. Shared master + overlay
   → nạp 50 dự án X2BMS (dùng seed/x2bms-project-import-sample.json) qua ImportJob: staging → mapping → normalize → geography → matching
   → duplicate review case X2P-000001 ↔ X2P-000002 ("X Riverside", human decision, KHÔNG auto-merge)
   → publish 10 MasterRecord → tạo TenantMasterOverlay X-TECH (tags/owner riêng)
C. Reconciliation + backup
   → reconcile batch (metrics: valid/matched/published/error)
   → backup tenant (REFERENCE_ONLY, gồm overlay+bindings+mappings, KHÔNG secret)
   → restore sandbox → verify overlay + master references + MUST_NOT_LEAK
```

Slice này chạm mọi acceptance gate `docs/11` (idempotent, impact preview, lineage/version, no cross-tenant leak, dry-run+metrics, human-confirm).

---

## 5. Thứ tự P0 → P1 → P2 (theo Sprint roadmap)

### P0 (Sprint 1-4, bắt buộc cho MVP control plane)
1. **Sprint 1 — Identity + App Control Plane**: CP-001 (adapter interface tường minh, đã có seam), CP-002 (IdentityAccount + session), CP-003 (app catalog + tenant instance), CP-004 (AppAccountBinding), CP-005 (AppRoleMapping versioned). FE màn CP-01…05.
2. **Sprint 2 — Provisioning/Sync**: CP-006 (ProvisioningCommand outbox idempotent/retry/DLQ — tái dùng mẫu `ConnectorCommand`+`CommandLog`), CP-007 (conflict center), CP-027 (audit/correlation), CP-029 (E2E provisioning). Deprovision impact plan. FE CP-06/07.
3. **Sprint 3 — Shared MDM Foundation**: CP-010 (MasterRecord/SourceRecord/Overlay/lineage), CP-011 (geography), CP-012 (org/developer master), CP-013 (project master), CP-021/022 (search+detail), CP-026 (RLS+visibility). FE CP-08…13.
4. **Sprint 4 — Ingestion 6.000 dự án**: CP-015 (staging framework), CP-016 (X2BMS adapter), CP-017 (normalization), CP-018 (matching engine), CP-019 (duplicate review UI), CP-030 (E2E import rehearsal batch gate). FE CP-14/15.

### P1 (Sprint 2-5, nâng chất lượng/tích hợp)
- CP-008 (Mattermost adapter skeleton dry-run), CP-009 (FinERP adapter skeleton manual), CP-014 (taxonomy manager), CP-020 (data quality dashboard), CP-023 (tenant backup scope), CP-024 (platform shared-data backup). FE CP-16…18.
- Org/Position/Delegation/Scope chuẩn (phụ thuộc Identity/Org Core).

### P2 (sau MVP)
- CP-025 (portable export migration), CP-028 (AI data steward — chỉ gợi ý mapping/dup/quality, human confirm; AI KHÔNG provision/merge/publish/restore theo `docs/09` + `CLAUDE.md:24`).

---

## 6. File/module xhub-api sẽ đụng (khi code — không phải bây giờ)

| Đụng | Kiểu | Lý do |
|---|---|---|
| `prisma/schema.prisma` | thêm models §2 | greenfield, không sửa model xoffice hiện có |
| `src/app.module.ts` | đăng ký module mới | wire control-plane/provisioning/mdm/mdm-import/backup |
| `src/auth/auth.service.ts` | nâng Membership→IdentityAccount | giữ nguyên OIDC seam + session (backward-compat header) |
| `src/xoffice/contracts/source-reference.ts` | tái dùng SourceReference | cho lineage MDM + provisioning result |
| `src/seed/seed.service.ts` | thêm seed application-catalog + geography + import sample | dùng `data/application-catalog.json`, `seed/x2bms-project-import-sample.json` |
| `xhub-web/src/app/(app)/admin/*` + route CP-01…18 mới | FE Tailux | nâng admin dashboard → control plane thật; đọc `AGENTS.md` (Next.js phiên bản mới) trước khi code |

---

## 7. Acceptance mapping (docs/11) — định nghĩa "done"

- Identity/sync: IdentityAccount ID không phụ thuộc provider; provisioning idempotent; suspend có impact preview; conflict không auto-link.
- MDM: geography không nhân bản per tenant; overlay không rò chéo; app operational không copy vào MDM; raw immutable; mọi master có lineage+version; merge/split có audit; 6.000 import qua staging+batch gate.
- Backup: tenant backup gồm overlay+bindings+mappings; shared canonical backup cấp platform; REFERENCE_ONLY restore OK; portable export có checksum; không password/token/secret; không MUST_NOT_LEAK.
- UX: đủ loading/empty/error/permission/stale; import dry-run+metrics; duplicate review keyboard; destructive có impact preview; AI chỉ suggestion.
- Mọi test có `demo-isolation` + `MUST_NOT_LEAK` (`CLAUDE.md:25`).
</content>
