# 0003: Stage pipeline and rail

Status: accepted (M3).

## Pipeline

```text
Blender (later) or tools/greybox/stage1.ts (now)
        │  writes
        ▼
public/assets/stages/stage1.glb      geometry + named empties (Path_, Look_, Spawn_, Cover_)
        │  npm run markers (tools/extract-markers.ts)
        ▼
public/data/stages/stage1.markers.json   positions, headings, cover half extents; generated
        │  read by
        ▼
src/sim (no GPU needed)      +      public/data/stages/stage1.json (encounters, hand-written)
```

- `npm run validate` fails if a stage names a marker that is not in its `.glb`, if `markers.json` is
  stale, if the `.glb` is missing, or if any asset lacks a row in `ASSETS.md`.
- The greybox script stands in for Blender until real stage art (M5). It writes exactly what a Blender
  glTF export would: Y-up, named empties, vertex-coloured meshes. Replacing it with a `.blend` export
  changes nothing downstream.
- Marker headings come from each empty's local +Z axis (yaw only; pitch and roll are ignored).
  Cover boxes are axis-aligned; their half extents are the empty's world scale.
- Tools run as plain `node file.ts` (Node type stripping, Node 22.18+ / 24). That is why relative
  imports use `.ts` extensions and `verbatimModuleSyntax` is on.

## Rail

- The camera rail is a centripetal Catmull-Rom curve through `Path_` empties in numeric order, with
  mirrored end points. It passes through every empty and does not overshoot on uneven spacing.
- Positions are looked up by distance along the curve (an arc-length table, 8 samples per metre),
  so `path_offset` and `travel_speed` stay in metres and metres per second. Measured error: steps of
  equal distance move within 3% of each other.
- The view eases the look direction toward each stop's `Look_` empty.

## Stage 1 greybox

Three areas on one 184.5 m rail: street entrance and ticket hall, a platform beside a parked
two-car train, and a service tunnel ending in a maintenance depot. 9 stops, 35 enemies (23 grunts,
8 runners, 4 heavies), 7 civilians, 6 cover boxes, 4,746 triangles in 3 meshes, 398 KB.

The simulation's clearing bot finishes it with 43 straight body hits for 37,000 points; the browser
test does the same through real screen-space shots. Rank thresholds (S 40,000, A 30,000,
B 18,000) are placeholders until the boss and a tuning pass.
