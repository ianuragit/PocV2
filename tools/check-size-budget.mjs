// Fails when the built site breaks the byte budgets in docs/spec.md (Assets and loading).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const MB = 1024 * KB;
const BUDGETS = { appCodeGzip: 400 * KB, site: 40 * MB };

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk('dist');
const site = files.reduce((n, f) => n + statSync(f).size, 0);
const code = files
  .filter((f) => /\.(js|css)$/.test(f))
  .reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);

const rows = [
  ['App code (gzip)', code, BUDGETS.appCodeGzip],
  ['Whole site', site, BUDGETS.site],
];
let failed = false;
for (const [name, used, max] of rows) {
  const ok = used <= max;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${(used / KB).toFixed(1)} KB of ${(max / KB).toFixed(0)} KB`);
}
if (failed) process.exit(1);
