/**
 * Contract type — Source Reference & Command Envelope (System-of-Record).
 *
 * MỤC ĐÍCH: chuẩn hóa cách XHub/X.Office THAM CHIẾU tới bản ghi do hệ thống khác
 * sở hữu (FinERP, Frappe HR, Mattermost, ESIGN, Calendar, Object Storage, ...) và
 * cách phát lệnh (command) tới hệ thống nguồn theo mô hình command → event, không
 * dual-write. Bám ma trận System-of-Record 120 (SOR nguyên tắc 5, 6, 11).
 *
 * TRẠNG THÁI: đây CHỈ là định nghĩa type (contract). CHƯA được wire vào
 * service/controller/prisma. Việc wire (thêm cột source_* trên ConnectorCommand,
 * correlationId/idempotencyKey trên lệnh, SourceReference trên UnifiedWorkItem)
 * là công việc phase sau — xem SOR_GAP_ANALYSIS.md (backlog P0/P1/P2).
 *
 * Liên quan: docs/architecture/adr-sor-001-system-ownership.md,
 * adr-sor-002-command-event-projection.md, adr-sor-003-xoffice-to-finerp-handoff.md.
 */

/**
 * Tham chiếu chuẩn tới một bản ghi thuộc hệ thống nguồn (System-of-Record).
 * XHub/X.Office KHÔNG sao chép master; chỉ lưu con trỏ này + deep link.
 */
export interface SourceReference {
  /** Tenant sở hữu tham chiếu (bắt buộc — multi-tenant SaaS). */
  tenantId: string;
  /** Hệ thống nguồn giữ trạng thái chuẩn (vd 'FINERP', 'FRAPPE_HR', 'MATTERMOST', 'ESIGN', 'XOFFICE'). */
  sourceSystem: string;
  /** Loại record nguồn (vd 'Material Request', 'Leave Application', 'Post'). */
  sourceType: string;
  /** Định danh record nguồn (vd 'MR-0001'). */
  sourceId: string;
  /** Phiên bản/tem thời gian nguồn — phục vụ stale-check & reconciliation. */
  sourceVersion?: string;
  /** Deep link tới bản ghi nguồn. KHÔNG chứa token/quyền. */
  deepLink?: string;
}

/**
 * Bao bọc mọi lệnh (command) gửi tới hệ thống nguồn hoặc phát trên outbox.
 * Bắt buộc mang đủ tenant/actor/correlation/idempotency (SOR nguyên tắc 11)
 * để bảo đảm tenant isolation, truy vết và retry idempotent.
 *
 * INTERFACE THAM CHIẾU cho phase wire sau — chưa dùng trong service hiện tại.
 */
export interface CommandEnvelope {
  /** Tenant phát lệnh. */
  tenantId: string;
  /** Chủ thể thực hiện (user/subject id) — dùng để hệ nguồn kiểm quyền tại nguồn. */
  actorId: string;
  /** Correlation id xuyên hệ thống để nối request → command → event → projection. */
  correlationId: string;
  /** Khóa idempotency — retry cùng khóa KHÔNG tạo tác dụng phụ trùng lặp. */
  idempotencyKey: string;
}
