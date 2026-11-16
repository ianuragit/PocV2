/**
 * Reads every stage .glb under public/assets/stages/ and writes public/data/stages/<id>.markers.json
 * with each marker empty's position, heading and (for Cover_) half extents.
 *
 *   node tools/extract-markers.ts           write the files
 *   node tools/extract-markers.ts --check   fail if a committed file is out of date (CI)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decompose, worldNodes } from './glb.ts';

const STAGES_GLB = 'public/assets/stages';
const STAGES_DATA = 'public/data/stages';
const MARKER = /^(Path|Look|Spawn|Cover|Crate)_/;

const round = (n: number) => Math.round(n * 1e4) / 1e4 + 0; // + 0 turns -0 into 0

export function extractMarkers(glb: Uint8Array): Record<string, unknown> {
  const markers: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const node of worldNodes(glb)) {
    if (!MARKER.test(node.name) || node.hasMesh) continue;
    if (seen.has(node.name)) throw new Error(`duplicate marker "${node.name}"`);
    seen.add(node.name);
    const { position, yaw, scale } = decompose(node.matrix);
    markers[node.name] = {
      position: position.map(round),
      rotation: [0, round(yaw), 0],
      ...(node.name.startsWith('Cover_') ? { scale: scale.map(round) } : {}),
    };
  }
  return Object.fromEntries(
    Object.entries(markers).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
  );
}

function main(): void {
  const check = process.argv.includes('--check');
  if (!existsSync(STAGES_GLB)) return;
  let stale = 0;
  for (const file of readdirSync(STAGES_GLB).filter((f) => f.endsWith('.glb'))) {
    const id = basename(file, '.glb');
    const out = join(STAGES_DATA, `${id}.markers.json`);
    const text = JSON.stringify(extractMarkers(readFileSync(join(STAGES_GLB, file))), null, 2) + '\n';
    const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
    if (current === text) {
      console.log(`markers: ${out} up to date`);
    } else if (check) {
      console.error(`markers: ${out} is out of date with ${file}; run npm run markers`);
      stale++;
    } else {
      writeFileSync(out, text);
      console.log(`markers: wrote ${out}`);
    }
  }
  if (stale > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
