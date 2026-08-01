/**
 * Restore request body. Validation is performed in BackupService (mirrors the
 * repo's inline-body style in controlplane / mdm — no class-validator).
 */
export interface RestoreRequestDto {
  mode: 'dry-run' | 'sandbox';
  targetTenantId?: string;
  /** Test hook (mirrors controlplane __failUntilAttempt): forces checksum mismatch. */
  tamper?: 'checksum';
}
