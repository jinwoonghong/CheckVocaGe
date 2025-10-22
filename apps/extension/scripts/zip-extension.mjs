import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'checkvocage-extension.zip');

function info(msg) { process.stdout.write(`[zip] ${msg}\n`); }
function fail(msg) { process.stderr.write(`[zip] ${msg}\n`); process.exit(1); }

if (!existsSync(DIST)) {
  fail(`dist not found: ${DIST}. Run \"pnpm build\" first.`);
}

try {
  if (existsSync(OUT)) rmSync(OUT);
} catch {}

const isWin = process.platform === 'win32';

if (isWin) {
  // Use PowerShell Compress-Archive (bundled on Windows)
  const ps = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path "${join(DIST, '*')}" -DestinationPath "${OUT}" -Force`
  ], { stdio: 'inherit' });
  if (ps.status !== 0) fail('Compress-Archive failed');
  info(`Created ${OUT}`);
  process.exit(0);
}

// Prefer zip on *nix runners
const zip = spawnSync('zip', ['-r', OUT, '.'], { cwd: DIST, stdio: 'inherit' });
if (zip.status === 0) {
  info(`Created ${OUT}`);
  process.exit(0);
}

// Fallback to 7z if zip is not available
const seven = spawnSync('7z', ['a', OUT, '*'], { cwd: DIST, stdio: 'inherit' });
if (seven.status !== 0) fail('No zip/7z available to create archive');
info(`Created ${OUT}`);
