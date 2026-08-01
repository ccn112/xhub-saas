// Repo secret scanner (Mục 8d). Scans committed source for high-entropy strings
// and known secret patterns, and FAILS (exit 1) if a secret is found OUTSIDE
// .env / .env.* files. Run: node scripts/secret-scan.mjs  (or: npm run scan:secrets)
//
// Excludes: node_modules, .git, dist, .next, storage, coverage, package-lock.json.
// .env and .env.* are the ONLY place secrets may live (and they are gitignored);
// a hit there is reported as OK (informational), a hit anywhere else FAILS.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep, basename } from 'node:path';

const ROOT = process.cwd();
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', 'storage', 'coverage', '.nyc_output', 'build',
]);
const EXCLUDE_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
// Only scan text-ish files.
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|prisma|env|yml|yaml|txt|sh|ps1)$/i;

// A file is an allowed secret store iff its basename is .env or starts with .env
const isEnvFile = (name) => name === '.env' || name.startsWith('.env');

const PATTERNS = [
  { name: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_\-]{20,}/g },
  { name: 'openai-key', re: /sk-[A-Za-z0-9]{32,}/g },
  { name: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'aws-secret-key', re: /aws_secret_access_key\s*[:=]\s*['"][A-Za-z0-9/+]{40}['"]/gi },
  { name: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { name: 'google-api-key', re: /AIza[0-9A-Za-z_\-]{35}/g },
  { name: 'slack-token', re: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  {
    name: 'generic-secret-assignment',
    // KEY-name that implies a secret, assigned a quoted 16+ char high-entropy value.
    re: /(?:api[_-]?key|secret|token|password|passwd|access[_-]?key|private[_-]?key)['"]?\s*[:=]\s*['"][A-Za-z0-9_\-/+]{16,}['"]/gi,
  },
];

// Allowlist: substrings that are known-safe even if they match a pattern (docs,
// placeholders, obvious dev/test values). Keeps false positives out.
const ALLOW_SUBSTRINGS = [
  'CHANGE-ME', 'CHANGE_ME', 'your-', 'example', 'placeholder', 'dev-webhook',
  'dev-xhub', 'REPLACE', 'xxxxx', '<', 'process.env', 'sk-ant-...',
];

const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      walk(full);
    } else {
      if (EXCLUDE_FILES.has(entry)) continue;
      if (!TEXT_EXT.test(entry) && !isEnvFile(entry)) continue;
      scanFile(full, entry);
    }
  }
}

function scanFile(full, name) {
  let text;
  try { text = readFileSync(full, 'utf8'); } catch { return; }
  const rel = relative(ROOT, full).split(sep).join('/');
  for (const { name: pname, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const matched = m[0];
      if (ALLOW_SUBSTRINGS.some((s) => matched.includes(s) || text.slice(Math.max(0, m.index - 40), m.index).includes(s))) {
        continue;
      }
      // Locate line number.
      const line = text.slice(0, m.index).split('\n').length;
      findings.push({ rel, name: pname, line, env: isEnvFile(name), preview: mask(matched) });
    }
  }
}

function mask(s) {
  if (s.length <= 12) return s.slice(0, 4) + '…';
  return s.slice(0, 8) + '…' + s.slice(-4);
}

console.log('Secret scan @ ' + ROOT);
walk(ROOT);

const outside = findings.filter((f) => !f.env);
const inEnv = findings.filter((f) => f.env);

for (const f of inEnv) {
  console.log(`  (ok, in env) ${f.rel}:${f.line} [${f.name}] ${f.preview}`);
}
for (const f of outside) {
  console.error(`  ✗ SECRET OUTSIDE ENV: ${f.rel}:${f.line} [${f.name}] ${f.preview}`);
}

if (outside.length > 0) {
  console.error(`\nSECRET SCAN FAILED: ${outside.length} secret(s) found outside .env files.`);
  process.exit(1);
}
console.log(`\nSECRET SCAN PASSED (no secrets outside .env; ${inEnv.length} env secret(s) noted).`);
process.exit(0);
