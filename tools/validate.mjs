// M0 placeholder for data validation: checks tuning.json parses and ASSETS.md exists.
// Stage schema, marker and asset-log checks arrive with M1 and M3.
import { existsSync, readFileSync } from 'node:fs';

let failed = false;
try {
  JSON.parse(readFileSync('public/data/tuning.json', 'utf8'));
} catch (e) {
  console.error(`public/data/tuning.json: ${e.message}`);
  failed = true;
}
if (!existsSync('ASSETS.md')) {
  console.error('ASSETS.md is missing');
  failed = true;
}
if (failed) process.exit(1);
console.log('validate: ok');
