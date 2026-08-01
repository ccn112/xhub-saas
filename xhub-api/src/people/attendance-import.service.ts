import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceDayService } from './attendance-day.service';
import { ATTENDANCE_IMPORT_TEMPLATE_VERSION } from './people.constants';

interface PreviewRow {
  row: number;
  personId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  error?: string;
}

/**
 * Attendance import engine (SME Lite — attendanceMode=FILE_IMPORT is the ONLY
 * way AttendanceEvent rows enter the system today, no live clock device).
 * Two-step "Excel Bridge" pattern: preview() parses + validates WITHOUT
 * writing AttendanceEvent; commit() writes; rollback() reverses exactly what
 * that batch wrote. `checksum` (sha256 of the raw CSV text) makes re-uploading
 * an identical file a 409, not a silent duplicate import.
 */
@Injectable()
export class AttendanceImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceDay: AttendanceDayService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  private parseCsv(content: string): { header: string[]; rows: string[][] } {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (!lines.length) throw new BadRequestException('empty file');
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const expected = ['personid', 'date', 'clockin', 'clockout'];
    if (JSON.stringify(header) !== JSON.stringify(expected)) {
      throw new BadRequestException(`invalid header — expected personId,date,clockIn,clockOut (got: ${lines[0]})`);
    }
    return { header, rows: lines.slice(1).map((l) => l.split(',').map((c) => c.trim())) };
  }

  async preview(tenantId: string, actorId: string, body: any) {
    const fileName = body?.fileName;
    const content = body?.content;
    if (!fileName) throw new BadRequestException('fileName is required');
    if (!content || typeof content !== 'string') throw new BadRequestException('content (CSV text) is required');

    const checksum = createHash('sha256').update(content).digest('hex');
    const dup = await this.db.attendanceImportBatch.findUnique({ where: { tenantId_checksum: { tenantId, checksum } } });
    if (dup) throw new ConflictException({ code: 'DUPLICATE_IMPORT', message: `identical file already imported as batch ${dup.id} (status ${dup.status})` });

    const { rows } = this.parseCsv(content);
    const personIds = [...new Set(rows.map((r) => r[0]).filter(Boolean))];
    const people = personIds.length
      ? await this.db.personProfile.findMany({ where: { tenantId, id: { in: personIds } } })
      : [];
    const knownPersonIds = new Set(people.map((p: any) => p.id));

    const preview: PreviewRow[] = rows.map((cols, idx) => {
      const [personId, date, clockIn, clockOut] = cols;
      const row = idx + 2; // +1 header, +1 1-indexed
      if (!personId || !knownPersonIds.has(personId)) return { row, personId, date, clockIn, clockOut, error: 'unknown personId' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return { row, personId, date, clockIn, clockOut, error: 'invalid date (expected YYYY-MM-DD)' };
      if (!/^\d{2}:\d{2}$/.test(clockIn ?? '') || !/^\d{2}:\d{2}$/.test(clockOut ?? '')) {
        return { row, personId, date, clockIn, clockOut, error: 'invalid time (expected HH:MM)' };
      }
      const [ih, im] = clockIn.split(':').map(Number);
      const [oh, om] = clockOut.split(':').map(Number);
      if (oh * 60 + om <= ih * 60 + im) return { row, personId, date, clockIn, clockOut, error: 'clockOut must be after clockIn' };
      return { row, personId, date, clockIn, clockOut };
    });
    const errorRows = preview.filter((p) => p.error).length;

    const batch = await this.db.attendanceImportBatch.create({
      data: {
        tenantId,
        templateVersion: ATTENDANCE_IMPORT_TEMPLATE_VERSION,
        fileName,
        checksum,
        status: 'PREVIEWED',
        totalRows: preview.length,
        validRows: preview.length - errorRows,
        errorRows,
        preview: preview as any,
        createdBy: actorId,
      },
    });
    return batch;
  }

  async list(tenantId: string) {
    const items = await this.db.attendanceImportBatch.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    return { items, count: items.length };
  }

  async commit(tenantId: string, actorId: string, id: string) {
    const batch = await this.db.attendanceImportBatch.findFirst({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException(`import batch not found: ${id}`);
    if (batch.status !== 'PREVIEWED') throw new ConflictException({ code: 'INVALID_BATCH_STATE', message: `batch is ${batch.status}, expected PREVIEWED` });

    const rows = (batch.preview as unknown as PreviewRow[]).filter((r) => !r.error);
    const affected = new Set<string>();
    for (const r of rows) {
      const clockInAt = new Date(`${r.date}T${r.clockIn}:00Z`);
      const clockOutAt = new Date(`${r.date}T${r.clockOut}:00Z`);
      await this.db.attendanceEvent.create({
        data: { tenantId, personId: r.personId, eventType: 'CLOCK_IN', at: clockInAt, source: 'FILE_IMPORT', importBatchId: batch.id, createdBy: actorId },
      });
      await this.db.attendanceEvent.create({
        data: { tenantId, personId: r.personId, eventType: 'CLOCK_OUT', at: clockOutAt, source: 'FILE_IMPORT', importBatchId: batch.id, createdBy: actorId },
      });
      affected.add(`${r.personId}|${r.date}`);
    }
    const updated = await this.db.attendanceImportBatch.update({ where: { id }, data: { status: 'COMMITTED', committedAt: new Date() } });
    for (const key of affected) {
      const [personId, date] = key.split('|');
      await this.attendanceDay.recomputeDay(tenantId, personId, new Date(`${date}T00:00:00Z`));
    }
    return updated;
  }

  async rollback(tenantId: string, actorId: string, id: string) {
    const batch = await this.db.attendanceImportBatch.findFirst({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException(`import batch not found: ${id}`);
    if (batch.status !== 'COMMITTED') throw new ConflictException({ code: 'INVALID_BATCH_STATE', message: `batch is ${batch.status}, expected COMMITTED` });

    const rows = (batch.preview as unknown as PreviewRow[]).filter((r) => !r.error);
    const affected = new Set(rows.map((r) => `${r.personId}|${r.date}`));
    await this.db.attendanceEvent.deleteMany({ where: { tenantId, importBatchId: id } });
    const updated = await this.db.attendanceImportBatch.update({ where: { id }, data: { status: 'ROLLED_BACK', rolledBackAt: new Date() } });
    for (const key of affected) {
      const [personId, date] = key.split('|');
      await this.attendanceDay.recomputeDay(tenantId, personId, new Date(`${date}T00:00:00Z`));
    }
    return updated;
  }
}
