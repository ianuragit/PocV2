/**
 * npm run budget: fails when the built site breaks the byte budgets in docs/spec.md (Assets and loading).
 * Text files are measured gzipped (as GitHub Pages serves them); models are measured raw.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readGlbJson } from './glb.ts';

const KB = 1024;
const MB = 1024 * KB;
const BUDGETS = {
  appCodeGzip: 400 * KB,
  titleLoad: 1.5 * MB,
  stageModel: 3 * MB,
  stageTriangles: 60_000,
  site: 40 * MB,
};

const DIST = 'dist';
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(DIST);
const rel = (f: string) => relative(DIST, f).split('\\').join('/');
const transferred = (f: string) =>
  /\.(js|css|html|json|txt|svg)$/.test(f) ? gzipSync(readFileSync(f)).length : statSync(f).size;

const rows: [string, number, number, string][] = [];
const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;

const code = files.filter((f) => /\.(js|css)$/.test(f));
rows.push(['App code (gzip)', code.reduce((n, f) => n + transferred(f), 0), BUDGETS.appCodeGzip, 'bytes']);

// Title screen: page, code, tuning, and stage 1's data and model (the title renders the stage).
const title = [
  ...code,
  join(DIST, 'index.html'),
  join(DIST, 'data/tuning.json'),
  join(DIST, 'data/stages/stage1.json'),
  join(DIST, 'data/stages/stage1.markers.json'),
  join(DIST, 'assets/stages/stage1.glb'),
].filter((f) => existsSync(f));
rows.push(['Title screen load', title.reduce((n, f) => n + transferred(f), 0), BUDGETS.titleLoad, 'bytes']);

for (const f of files.filter((x) => x.endsWith('.glb'))) {
  const bytes = readFileSync(f);
  rows.push([`${rel(f)} size`, bytes.byteLength, BUDGETS.stageModel, 'bytes']);
  const gltf = readGlbJson(bytes) as {
    meshes?: { primitives: { attributes: { POSITION: number }; indices?: number }[] }[];
    accessors?: { count: number }[];
  };
  let tris = 0;
  for (const m of gltf.meshes ?? []) {
    for (const p of m.primitives) tris += gltf.accessors![p.indices ?? p.attributes.POSITION]!.count / 3;
  }
  rows.push([`${rel(f)} triangles`, tris, BUDGETS.stageTriangles, 'count']);
}

rows.push(['Whole site', files.reduce((n, f) => n + statSync(f).size, 0), BUDGETS.site, 'bytes']);

let failed = false;
for (const [name, used, max, unit] of rows) {
  const ok = used <= max;
  failed ||= !ok;
  const show = (n: number) => (unit === 'bytes' ? kb(n) : String(n));
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${show(used)} of ${show(max)}`);
}
if (failed) process.exit(1);
