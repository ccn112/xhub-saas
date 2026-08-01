import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ZONE_KINDS } from './ioc.catalog';

/**
 * Floor-plan geometry validation (AT-004) + canonical checksum (AT-002).
 *
 * All coordinates are METERS (doc 04: "Store units in meters; pixels only
 * viewport transform"). A polygon must be simple (non-self-intersecting), have
 * ≥3 distinct vertices and a non-zero area; zone ids must be unique within the
 * plan. Rejection is a 400 from the API — the editor never persists bad geometry.
 */

export interface Point { x: number; y: number }

export interface Zone {
  id: string;
  name: string;
  kind: string;
  orgUnitId?: string | null;
  polygon: Point[];
}

export interface Wall {
  id: string;
  points: Point[];
  thickness?: number;
  height?: number;
}

export interface Geometry {
  walls: Wall[];
  zones: Zone[];
}

const MAX_ZONES = 200;
const MAX_VERTICES = 200;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function pt(p: unknown, where: string): Point {
  const o = p as Point;
  if (!o || !isNum(o.x) || !isNum(o.y)) throw new BadRequestException(`${where}: point must be { x:number, y:number }`);
  if (Math.abs(o.x) > 1e5 || Math.abs(o.y) > 1e5) throw new BadRequestException(`${where}: coordinate out of range (meters)`);
  return { x: o.x, y: o.y };
}

/** Signed area × 2. Positive = counter-clockwise in screen space. */
export function signedArea2(poly: Point[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

export function areaSqMeters(poly: Point[]): number {
  return Math.abs(signedArea2(poly)) / 2;
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= p.y && p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function sign(n: number): number {
  return Math.abs(n) < 1e-9 ? 0 : n > 0 ? 1 : -1;
}

/** True when segments p1p2 and p3p4 properly intersect (shared endpoints allowed). */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = sign(cross(p3, p4, p1));
  const d2 = sign(cross(p3, p4, p2));
  const d3 = sign(cross(p1, p2, p3));
  const d4 = sign(cross(p1, p2, p4));
  if (d1 !== d2 && d3 !== d4) return true;
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;
  return false;
}

/** O(n²) simple-polygon test — n is bounded by MAX_VERTICES so this is fine. */
export function isSelfIntersecting(poly: Point[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges (they legitimately share a vertex)
      if (j === i) continue;
      if ((j + 1) % n === i || (i + 1) % n === j) continue;
      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/** Normalize a polygon to clockwise-in-meter-space order (doc 04). */
export function normalizeClockwise(poly: Point[]): Point[] {
  return signedArea2(poly) > 0 ? [...poly].reverse() : poly;
}

/**
 * Validate + normalize a whole geometry payload. Throws BadRequestException with
 * a precise message on the first violation (AT-004).
 */
export function validateGeometry(raw: unknown): Geometry {
  const g = (raw ?? {}) as Partial<Geometry>;
  const zonesIn = Array.isArray(g.zones) ? g.zones : [];
  const wallsIn = Array.isArray(g.walls) ? g.walls : [];
  if (zonesIn.length > MAX_ZONES) throw new BadRequestException(`too many zones (${zonesIn.length} > ${MAX_ZONES})`);

  const seen = new Set<string>();
  const zones: Zone[] = zonesIn.map((z, idx) => {
    const where = `zones[${idx}]`;
    if (!z?.id || typeof z.id !== 'string') throw new BadRequestException(`${where}: id is required`);
    if (seen.has(z.id)) throw new BadRequestException(`${where}: duplicate zone id "${z.id}"`);
    seen.add(z.id);
    if (!z.name || typeof z.name !== 'string') throw new BadRequestException(`${where}: name is required`);
    const kind = (z.kind ?? 'DEPARTMENT').toUpperCase();
    if (!(ZONE_KINDS as readonly string[]).includes(kind)) throw new BadRequestException(`${where}: invalid kind ${kind}`);
    if (!Array.isArray(z.polygon) || z.polygon.length < 3) throw new BadRequestException(`${where}: polygon needs at least 3 points`);
    if (z.polygon.length > MAX_VERTICES) throw new BadRequestException(`${where}: polygon has too many vertices`);
    const poly = z.polygon.map((p, i) => pt(p, `${where}.polygon[${i}]`));
    // reject repeated consecutive vertices (degenerate edges)
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) {
        throw new BadRequestException(`${where}: polygon has a zero-length edge at vertex ${i}`);
      }
    }
    // Order matters: a symmetric bow-tie has a shoelace area of ~0, so the
    // self-intersection check must run FIRST to give the accurate reason.
    if (isSelfIntersecting(poly)) throw new BadRequestException(`${where}: polygon is self-intersecting`);
    if (areaSqMeters(poly) < 0.25) throw new BadRequestException(`${where}: polygon area is degenerate (< 0.25 m²)`);
    return {
      id: z.id,
      name: z.name,
      kind,
      orgUnitId: z.orgUnitId ?? null,
      polygon: normalizeClockwise(poly),
    };
  });

  const walls: Wall[] = wallsIn.map((w, idx) => {
    const where = `walls[${idx}]`;
    if (!w?.id || typeof w.id !== 'string') throw new BadRequestException(`${where}: id is required`);
    if (!Array.isArray(w.points) || w.points.length < 2) throw new BadRequestException(`${where}: needs at least 2 points`);
    const height = w.height ?? 3;
    if (!isNum(height) || height < 0.5) throw new BadRequestException(`${where}: height must be >= 0.5 m`);
    const thickness = w.thickness ?? 0.15;
    if (!isNum(thickness) || thickness < 0.02) throw new BadRequestException(`${where}: thickness must be >= 0.02 m`);
    return { id: w.id, points: w.points.map((p, i) => pt(p, `${where}.points[${i}]`)), height, thickness };
  });

  return { walls, zones };
}

/** Deterministic key ordering so the same logical payload always hashes alike. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = canonical(src[k]);
    return out;
  }
  return value;
}

/** SHA-256 over the canonicalized payload — the immutability proof (AT-002). */
export function checksumOf(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}
