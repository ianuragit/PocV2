import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateStage } from '../../src/sim/stage';
import type { Markers } from '../../src/sim/types';
import { readJson, tuning } from '../helpers';

const dir = 'public/data/stages';
const stages = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.markers.json'));

describe('stage data', () => {
  it('has at least one stage', () => {
    expect(stages.length).toBeGreaterThan(0);
  });

  for (const file of stages) {
    it(`${file} is valid against its markers and tuning`, () => {
      const markers = readJson<Markers>(`${dir}/${file.replace('.json', '.markers.json')}`);
      expect(validateStage(readJson(`${dir}/${file}`), markers, tuning())).toEqual([]);
    });
  }
});
