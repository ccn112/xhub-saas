// Reusable Avatar — renders an <img> when `src` (avatarUrl) is present, else a
// deterministic initials avatar (colored circle from a hash of the name + white
// initials). No external network calls; theme-aware. Used by the staff org chart.

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

// Palette mirrors the backend seeder so img/initials avatars feel consistent.
const PALETTE = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#2563eb"];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  const dim = { width: size, height: size, minWidth: size } as const;
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={dim}
        className={["shrink-0 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10", className ?? ""].join(" ")}
      />
    );
  }
  const bg = PALETTE[hash(name) % PALETTE.length];
  return (
    <span
      aria-label={name}
      title={name}
      style={{ ...dim, backgroundColor: bg, fontSize: Math.round(size * 0.4) }}
      className={["inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/5 dark:ring-white/10", className ?? ""].join(" ")}
    >
      {initials(name)}
    </span>
  );
}
