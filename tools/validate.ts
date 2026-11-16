/**
 * npm run validate: every data check that does not need a browser.
 *   - tuning.json parses
 *   - each stage JSON is valid against its markers and tuning (marker names exist, offsets ascend, ...)
 *   - each stage's environment .glb exists, and its markers.json is up to date with it
 *   - every file under public/assets/ has a row in ASSETS.md
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateStage } from '../src/sim/stage.ts';
import type { Markers, Tuning } from '../src/sim/types.ts';
import { extractMarkers } from './extract-markers.ts';

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);
const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

let tuning: Tuning | undefined;
try {
  tuning = readJson('public/data/tuning.json') as Tuning;
} catch (e) {
  fail(`public/data/tuning.json: ${(e as Error).message}`);
}

const STAGES = 'public/data/stages';
const stageFiles = readdirSync(STAGES).filter(
  (f) => f.endsWith('.json') && !f.endsWith('.markers.json') && f !== 'index.json',
);
if (stageFiles.length === 0) fail(`${STAGES}: no stages`);
for (const file of stageFiles) {
  const path = join(STAGES, file);
  const markersPath = join(STAGES, file.replace(/\.json$/, '.markers.json'));
  if (!existsSync(markersPath)) {
    fail(`${path}: missing ${markersPath}`);
    continue;
  }
  const stage = readJson(path) as { environment?: unknown };
  const markers = readJson(markersPath) as Markers;
  if (tuning) for (const e of validateStage(stage, markers, tuning)) fail(`${path}: ${e}`);

  if (typeof stage.environment === 'string' && stage.environment !== 'procedural') {
    const glb = join('public/assets', stage.environment);
    if (!existsSync(glb)) {
      fail(`${path}: environment ${glb} does not exist`);
    } else {
      const expected = JSON.stringify(extractMarkers(readFileSync(glb)), null, 2) + '\n';
      if (readFileSync(markersPath, 'utf8') !== expected) {
        fail(`${markersPath}: out of date with ${glb}; run npm run markers`);
      }
    }
  }
}

// Stage catalogue: every listed stage exists and its name matches the stage file.
const catalog = readJson(join(STAGES, 'index.json')) as { stages?: { id: string; name: string }[] };
if (!Array.isArray(catalog.stages) || catalog.stages.length === 0)
  fail(`${STAGES}/index.json: needs a stages list`);
for (const entry of catalog.stages ?? []) {
  const file = join(STAGES, `${entry.id}.json`);
  if (!existsSync(file)) fail(`${STAGES}/index.json: ${entry.id} has no ${file}`);
  else if ((readJson(file) as { name?: string }).name !== entry.name)
    fail(`${STAGES}/index.json: name for ${entry.id} differs from ${file}`);
}

// Licence log: every asset file needs a row naming it in ASSETS.md.
const log = existsSync('ASSETS.md') ? readFileSync('ASSETS.md', 'utf8') : '';
if (!log) fail('ASSETS.md is missing');
const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];
for (const file of walk('public/assets')) {
  const rel = relative('public/assets', file).split('\\').join('/');
  if (!log.includes(`\`${rel}\``)) fail(`ASSETS.md: no row for \`${rel}\``);
}

if (errors.length > 0) {
  for (const e of errors) console.error(`validate: ${e}`);
  process.exit(1);
}
console.log(`validate: ok (${stageFiles.length} stages)`);
