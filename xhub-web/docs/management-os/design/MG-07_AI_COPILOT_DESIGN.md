# MG-07 — THIẾT KẾ AI COPILOT (mở rộng xoffice AI, KHÔNG làm lại)

> Design spec cho lớp AI hỗ trợ quản trị — **mở rộng service AI đã có** ở
> `xhub-api/src/xoffice/xoffice.service.ts`, KHÔNG reinvent.
> Ground truth: `docs/11_AI_AUGMENTED_MANAGEMENT.md`, `data/AI_USE_CASE_CATALOG.csv`,
> code hiện hữu `aiDraft()` / `aiDraftLive()` / `aiDraftMock()`. Docs-first: KHÔNG code, KHÔNG sửa src/.

## 1. Mục đích & nguyên tắc nền

AI trong MOS phải nằm **trong decision architecture & operating rhythm**, không chỉ là "reporting upgrade" (doc 11). Mọi AI đều **draft-first, human-apply** — tái dùng nguyên khung đã có ở xoffice.

**Tái dùng (KHÔNG viết lại):**
- Client `Anthropic` (`@anthropic-ai/sdk`) khởi tạo khi có `ANTHROPIC_API_KEY`.
- Cờ live/mock: `XOFFICE_AI_LIVE=true` → gọi Claude thật, lỗi/timeout/invalid schema → fallback `aiDraftMock`. Model từ `XOFFICE_AI_MODEL` (mặc định `claude-opus-4-8`).
- Hợp đồng output đã có: `{ summary, operations, assumptions[], evidence[{sourceType,sourceId,label}], validation:{requiresHumanApply,appliedToProduction}, mustRequireHumanApply:true }`.
- Ajv validate output trước khi cho preview; chỉ patch hợp lệ mới hiển thị.
- **`mustRequireHumanApply: true`** gắn cứng vào mọi kết quả (cả live lẫn mock) → không đường nào auto-apply.

MOS mở rộng khung này thành **AI suggestion per-action** map tới `AI_USE_CASE_CATALOG`, dùng chung flow draft→preview→human-apply + audit log.

## 2. Bản đồ use case → màn → rủi ro (AI_USE_CASE_CATALOG.csv)

| Code | Use case | Risk | Xuất hiện ở màn /manage | Control (doc 11) |
|---|---|---|---|---|
| **AI-01** | Pre-read generator | LOW | `/manage/reviews` (Business Review), `/manage/meetings` | Human review trước publish |
| **AI-02** | KPI anomaly + causal hypothesis | MEDIUM | `/manage/metrics`, `/manage/dashboards` | Source/confidence bắt buộc |
| **AI-03** | Meeting transcript → decisions/actions | MEDIUM | `/manage/meetings`, `/manage/decisions` | Facilitator confirmation |
| **AI-04** | Decision option brief | MEDIUM | `/manage/decisions` (RAPID) | Decider confirmation |
| **AI-05** | Project delay prediction | MEDIUM | `/manage/portfolio`, `/manage/reviews` | Explainable features + PM review |
| **AI-06** | Đánh giá nhân viên | **HIGH** | (không surface tự động) | **RESTRICTED advisory only** |
| **AI-07** | Auto-approve giao dịch tài chính | **PROHIBITED** | — | **Không cho phép** |

### Chi tiết surface & output từng use case
- **AI-01 pre-read** (LOW): nút "Soạn pre-read" ở màn Review/Meeting → draft agenda theo exception + tóm tắt thay đổi từ kỳ trước + phát hiện missing/stale data. Human review trước khi đính vào BusinessReview. Vì LOW nhưng vẫn qua human-apply (không auto-publish).
- **AI-02 anomaly** (MEDIUM): trên mỗi KPI đỏ/lệch ngưỡng ở `/manage/metrics` → panel "Giả thuyết nguyên nhân": anomaly + causal hypothesis, **bắt buộc source (metric/observation id) + confidence**. AI KHÔNG kết luận; đề xuất để người phân tích xác nhận.
- **AI-03 meeting→actions** (MEDIUM): từ transcript sinh draft decisions/actions, tự phát hiện action **thiếu owner/due date**. Facilitator confirm từng item trước khi tạo ActionCommitment/NativeWorkItem hoặc DecisionRecord.
- **AI-04 decision brief** (MEDIUM): ở `/manage/decisions` (RAPID) → brief các phương án (option, trade-off, evidence). Decider (role D trong RAPID) phải confirm; AI không chọn hộ.
- **AI-05 delay prediction** (MEDIUM): ở `/manage/portfolio` & review → dự báo trễ với **explainable features** (schedule/scope/cost/risk/decision latency). PM review; **AI KHÔNG tự đổi `ExecutionProject.health`** (doc 07: không tự thay health thủ công nếu chưa có policy).

## 3. GUARDRAILS (bắt buộc — Constitution #10, #11; doc 11)

Mọi output AI phải có **4 thành phần** (tái dùng shape hiện hữu):
1. **source / evidence** — `evidence[{sourceType, sourceId, label}]` (metric id, observation, role, project…).
2. **confidence** — mức tin (0..1 hoặc band), hiển thị rõ.
3. **assumptions** — `assumptions[]` giả định đã dùng.
4. **human-confirm** — `mustRequireHumanApply: true` + `validation.requiresHumanApply`; không có evidence/confidence → không cho apply.

**AI KHÔNG BAO GIỜ (#10):**
- auto-approve giao dịch/quyết định (**AI-07 PROHIBITED** — chặn cứng, không cấu hình bật được).
- tự thay target/baseline/forecast chính thức.
- tự đóng risk trọng yếu.
- tự chấm/đề xuất kỷ luật nhân viên chỉ từ KPI (**AI-06 RESTRICTED advisory only** — không surface tự động, chỉ hiện khi role có quyền, luôn nhãn "tư vấn, không phải quyết định", không sinh action nhân sự).

**PII & audit (doc 11):** phân loại dữ liệu, giảm thiểu PII trong prompt; lưu prompt/tool/kết quả cho use case material.

## 4. Surface flow: draft → preview → human-apply

Tái dùng nguyên vòng đã có ở `aiDraft()`:

```
[Người dùng bấm "AI đề xuất" tại 1 action trong màn /manage]
        │  (kèm ngữ cảnh: screen, entity id, prompt VI)
        ▼
aiDraft(slug, prompt, screen)  ──live?──►  Claude (XOFFICE_AI_MODEL)  ──► validate Ajv
        │ mock fallback                                                        │
        ▼                                                                      ▼
   { summary, operations, assumptions[], evidence[], confidence,
     validation:{requiresHumanApply:true, appliedToProduction:false},
     mustRequireHumanApply:true, source:'live'|'mock' }
        ▼
[PREVIEW card]  hiện summary + evidence(source) + confidence + assumptions
        ▼
[Human bấm "Áp dụng"]  ──► apply endpoint (ghi vào entity Mgmt-owned, KHÔNG production tự động)
        ▼
[AI audit log]  ghi: actor, screen, useCaseCode, prompt(hash/redacted), model, source,
                confidence, evidenceRefs, applied?(yes/no), appliedBy, at
```

**Không có nhánh nào bỏ qua bước "Human bấm Áp dụng".** Preview KHÔNG ghi gì; apply là hành động của người, gắn actorId.

## 5. Entity mới (chỉ AI audit — phần còn lại tái dùng)

### AiSuggestion (transient/log)
| Trường | Ghi chú |
|---|---|
| id, tenantId | |
| useCaseCode | `AI-01..AI-05` (AI-06 gated, AI-07 cấm) |
| screen, targetEntityType, targetEntityId | nơi phát sinh |
| promptRedacted | prompt đã giảm PII |
| model, source | `claude-opus-4-8`, `live`/`mock` |
| summary, operations(json), assumptions[], evidence[] | output |
| confidence | number |
| status | `DRAFT · PREVIEWED · APPLIED · DISCARDED` |
| createdBy, createdAt | |

### AiAuditEvent (append-only — mở rộng AuditEvent hiện có)
`{ id, tenantId, suggestionId, action: SUGGESTED|PREVIEWED|APPLIED|REJECTED, actorId, at, appliedEntityRef? }`. Bất biến; là bằng chứng cho use case material (doc 11).

## 6. Endpoints (mở rộng namespace xoffice/manage)

```
POST /manage/ai/suggest        { screen, useCaseCode, targetEntityId, prompt }
                               → gọi aiDraft, trả suggestion (KHÔNG ghi entity đích)
POST /manage/ai/:id/apply      human-apply: ghi vào entity Mgmt-owned + audit APPLIED
POST /manage/ai/:id/discard    audit REJECTED
GET  /manage/ai/audit?entity=  đọc AI audit log (AUDITOR/owner)
```

Chặn cứng: `useCaseCode=AI-07` → 403 luôn. `AI-06` → yêu cầu permission đặc biệt + luôn advisory (không sinh action).

## 7. Seed

- Scenario mock cho AI-01..AI-05 trong file kiểu `ai-assistance-scenarios.json` (như xoffice đã có) để demo không cần key: mỗi scenario có `screen`, `prompt`, `patch` (summary/operations/assumptions/evidence/confidence) + `mustRequireHumanApply:true`.
- Một AiAuditEvent mẫu ở trạng thái APPLIED để test màn audit.

## 8. Test plan

- **Guard 4 thành phần:** output thiếu evidence/confidence → không cho apply (Ajv/validator fail).
- **Human-apply:** không endpoint/nhánh nào ghi entity đích khi mới suggest; chỉ `/apply` (có actorId) mới ghi.
- **AI-07:** mọi request PROHIBITED bị 403, không cấu hình bật được.
- **AI-06:** không surface tự động; chỉ role có quyền, luôn nhãn advisory, không sinh action nhân sự.
- **No baseline change:** AI-05 không đổi ExecutionProject.health/baseline; AI-03 không tự tạo ActionCommitment khi chưa confirm.
- **Fallback:** không có `ANTHROPIC_API_KEY` hoặc `XOFFICE_AI_LIVE≠true` → dùng mock, vẫn `mustRequireHumanApply:true`.
- **Audit:** mỗi suggest/preview/apply/reject ghi append-only, redact PII.
- **RLS:** suggestion/audit cô lập theo tenant.

## 9. Constitution guards

- **#10** AI không auto-approve / không đổi baseline·target·forecast / không tự quyết — chặn ở endpoint + `mustRequireHumanApply`.
- **#11** mọi output có source + confidence + assumptions + human-confirm; lưu audit.
- **#12** AI đọc metric từ read model, không direct-DB/dual-write; apply chỉ ghi entity Mgmt-owned.

## 10. LINKS tới thành phần đã tồn tại (KHÔNG nhân đôi)

- Mở rộng **`XofficeService.aiDraft/aiDraftLive/aiDraftMock`** (`xhub-api/src/xoffice/xoffice.service.ts`) — cùng client, cờ env, Ajv, fallback.
- Tái dùng shape **`WorkflowPatchSet`** (summary/operations/assumptions/evidence/validation/mustRequireHumanApply) + `SourceReference`.
- Mở rộng **`AuditEvent`** hiện có cho AI audit, không tạo hệ audit song song.
- AI-05 đọc **`ExecutionProject`** (health/schedule) qua API Work — không ghi; AI-03 sinh draft **`NativeWorkItem`**/DecisionRecord qua flow có human confirm.
- AI-02 đọc **`MetricDefinition`/`MetricObservation`** (reference slice) làm evidence.
