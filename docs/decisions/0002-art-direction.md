# 0002: Art direction

Status: accepted for greybox through M4; revisit when real stage models arrive in M5.

An original mid-90s arcade 3D look, built from the general traits of that era of rail shooters rather
than from any one game. No screenshots, models, sight designs, HUD layouts, characters or stages from
existing games are copied.

| Element | Choice | Where |
| --- | --- | --- |
| Resolution | 3D renders at 360 lines, scaled up with `image-rendering: pixelated`; HUD and sights stay sharp | `view/style.ts` `RENDER_LINES`, `view/renderer.ts` |
| Models | Flat-shaded boxes in saturated colours, one outfit per enemy type, sized to the simulation's hit zones | `view/characters.ts`, `view/style.ts` `OUTFITS` |
| Civilians | White and blue outfit, a bright blue outline, hands raised | `view/characters.ts` |
| Environment | Gradient sky dome, 2 m checker floor, teal side walls with a yellow stripe, columns, benches, bins; all outside the play area | `view/stageView.ts` |
| Threat sight | Four corner brackets that rotate from a wide diamond into a tight square, cyan to amber to red, blinking just before the shot | `view/overlay.ts` `drawSight` |
| Hits | Hard-edged triangle star: yellow on enemies, blue on civilians, small grey on misses | `view/overlay.ts` `drawBurst` |
| HUD | Skewed panel with a 7-digit score, combo line, diamond life pips, bullet strip, heavy italic outlined lettering from system fonts | `ui/styles.css`, `ui/hud.ts` |

Animation stays within a few centimetres of the rest pose so the model always matches the hit zones.
Models do not move from their spawn marker until movement is simulated (M4).
