/**
 * Art direction: an original mid-90s arcade look. The 3D scene renders at a low line count and is
 * scaled up with hard pixels; models are flat-shaded boxes in saturated colours; the HUD stays sharp.
 */

/** Vertical resolution of the 3D render before it is scaled up to the window. */
export const RENDER_LINES = 360;

export const SKY = { top: 0x2a6fdb, horizon: 0xbfe3ff, fog: 0xb7d7f0 };

export const PALETTE = {
  floorA: 0xd9c9a3,
  floorB: 0xc4b083,
  wall: 0x2e9c94,
  wallDark: 0x247d77,
  stripe: 0xffc21a,
  column: 0xe8e2d0,
  columnBand: 0xd8432f,
  bench: 0x8b5a2b,
  bin: 0x3d4a5c,
  crate: 0xb8863b,
  crateEdge: 0x5a3d14,
};

export interface Outfit {
  jacket: number;
  trim: number;
  pants: number;
  skin: number;
  hat?: { color: number; kind: 'beanie' | 'cap' | 'helmet' };
  /** Width multiplier for the torso. */
  bulk?: number;
  /** A long coat over the legs. */
  coat?: number;
}

/** One outfit per actor type. Bold, readable at a glance, and distinct from each other. */
export const OUTFITS: Record<string, Outfit> = {
  grunt: {
    jacket: 0xb3262e,
    trim: 0xf2f2f2,
    pants: 0x2b2f3a,
    skin: 0xc98e64,
    hat: { color: 0x1c1c22, kind: 'beanie' },
  },
  runner: {
    jacket: 0xf2b705,
    trim: 0x1c1c22,
    pants: 0x3b4cc0,
    skin: 0x8d5a3b,
    hat: { color: 0xd8432f, kind: 'cap' },
  },
  heavy: {
    jacket: 0x5b2a86,
    trim: 0x9aa3ad,
    pants: 0x1f2028,
    skin: 0xb07a52,
    hat: { color: 0x3a3f47, kind: 'helmet' },
    bulk: 1.25,
  },
  civilian: { jacket: 0xf4f6fa, trim: 0x67b6ff, pants: 0x6b7a8f, skin: 0xe2b48c },
  shield: {
    jacket: 0x2b3b63,
    trim: 0x9aa3ad,
    pants: 0x1f2433,
    skin: 0xb98a63,
    hat: { color: 0x1a2240, kind: 'helmet' },
  },
  thrower: {
    jacket: 0xe8642c,
    trim: 0x2b2b2b,
    pants: 0x4a4f2a,
    skin: 0xd2a079,
    hat: { color: 0x2b2b2b, kind: 'beanie' },
  },
  vehicle: {
    jacket: 0x6c7480,
    trim: 0xf2c230,
    pants: 0x2b2f3a,
    skin: 0xa8734f,
    hat: { color: 0xf2c230, kind: 'cap' },
  },
  boss: { jacket: 0x0f5e63, trim: 0xd9b23a, pants: 0x14181f, skin: 0xc48c66, bulk: 1.3, coat: 0x0b4a4e },
};

/** Crate band colour per weapon, so the prize is readable before it is shot open. */
export const CRATE_COLORS: Record<string, number> = {
  shotgun: 0xd8323c,
  machine_pistol: 0x2f6fd6,
  magnum: 0xf2c230,
};
export const CRATE_WOOD = { side: 0xb8863b, edge: 0x6b4a1c };
export const BRICK = 0xb5482e;

/** Threat sight colours, from first appearing to about to fire. */
export const SIGHT_COLORS = { safe: '#36e0ff', warn: '#ffb020', danger: '#ff3355' };

export const CIVILIAN_OUTLINE = 0x67b6ff;
