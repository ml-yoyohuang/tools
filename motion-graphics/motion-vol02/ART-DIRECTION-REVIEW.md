# Art Direction Review — Motion Studies Vol. 02

How each piece was reviewed, what was wrong with the first versions, and what is still not right.
Scores use the brief's rubric and are self-assessments — a way of naming defects, not evidence of quality.

## Method (what was actually done)

- **Composition review:** every piece was screenshotted in headless Chromium at 7–16 time positions at 1440 × 900, and at
  key positions at 390 × 844 (phone) and 768 × 1024 (tablet), then inspected as contact sheets and full-resolution crops.
  Selected key frames are saved in [`keyframes/`](keyframes/).
- **Motion review:** done from dense sampled frames and contact sheets, not by watching real-time playback. Timing, pauses and
  causality were judged from those sequences; perceived smoothness at speed was **not** judged by eye.
- **Technical review:** a scripted suite (Playwright) per piece — autoplay, Space / R / L / I / Esc / arrows, play button,
  scrubber, once-mode ending, loop wrap, idle fade and return, determinism (same time → identical frame), fullscreen control,
  back link, horizontal overflow, console errors, reduced motion on a phone viewport. A pixel comparison of t = 0 against t = D − 0.01
  for loop continuity. Frame times measured on a real GPU (GTX 1050 Ti) with Chromium/ANGLE.

## Scores

| Work | Art Dir. /25 | Composition /20 | Motion /20 | Originality /15 | Material /10 | Technical /10 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| 07 Liquid Typography | 22 | 17 | 17 | 13 | 8 | 8 | **85** |
| 08 Elastic Letterforms | 21 | 16 | 18 | 13 | 9 | 9 | **86** |
| 09 Paper Engineering | 23 | 18 | 17 | 14 | 9 | 9 | **90** |
| 10 Iridescent Sculpture | 22 | 17 | 16 | 12 | 9 | 9 | **85** |
| 11 Light Through Glass | 21 | 17 | 16 | 13 | 7 | 9 | **83** |
| 12 Time as Material | 21 | 16 | 17 | 13 | 8 | 9 | **84** |

Only 09 reaches the 90 target, and that judgement is mine alone.

---

## 07 — Liquid Typography

**First version — problems.** (1) The drip was a union of 7 shifted copies, so drips read as stacked stair-steps. (2) Morphing
between two distance fields that do not overlap made "solid" simply vanish on the left while "liquid" appeared on the right — no
liquid ever travelled. (3) The gloss used screen-space derivatives and came out as sparkle noise. (4) On phones the vertical word
was cropped and collided with its definition.

**Changes and why.** Drips became a 22-sample sweep joined with a smooth-min, so they are continuous bodies. During the morph, the
first word's field is carried into the second's frame (translated, turned 90°, scaled) — the mass now visibly falls over and stands up,
which is the poster's whole idea. The highlight became an analytic meniscus band just inside light-facing edges, with the edge
direction from wide finite differences: it reads as wet enamel instead of glitter. Portrait sizes were re-set.

**Unresolved.** A faint texture remains inside counters while they close (8-bit field). The ≈10 s mid-morph frame is a formless
mass; that is intended, but it is the weakest still. The definitions are small on phones.

## 08 — Elastic Letterforms

**First version — problems.** Bodoni's hairlines fell below the tracing threshold at 360 px, so the e's bowl and the n's joins broke
apart during deformation. Strikes were too gentle to read as impacts. On phones a single line became a thin strip. The loop restart showed
the unison stretch still ringing at ~3 %.

**Changes and why.** Tracing at 1000 px keeps every hairline; per-frame cost was held down by evaluating the oscillator modes in
48 height bands per letter. Landing impulses were strengthened and given alternating sway, so neighbouring letters lean against
each other. Tall frames set the word on two strings. Damping was raised and a final settle brings everything to exact rest before the loop.

**Unresolved.** "Stretch toward the top" stands in for real stroke-dependent stiffness. The landscape still has a lot of empty
yellow above the word between flights; it is the dot's space, but stills taken at rest are a band of type on a field.

## 09 — Paper Engineering

**First version — problems.** The four large characters on the back were missing (positions in `em` resolved against their own
15em font size, placing them far off the sheet). The left gate folded *into* the table (hinge sign). The standing screen leaned toward
the camera and was cropped at the bottom. On phones the accordion was seen almost edge-on.

**Changes and why.** Placement now resolves to pixels of the sheet. Hinges fold toward the viewer in both orientations. The stand
angle was lowered and the camera re-framed. Tall frames fold a shallower relief and tilt toward the viewer, so the louvres read.

**Unresolved.** No visible paper thickness at the edges, and panels never bend between creases. The page-turn at 19 s briefly shows the
sheet near edge-on.

## 10 — Iridescent Sculpture

**First version — problems.** The ring overflowed the frame and the plate text overlapped it. At peak thickness, third-order
interference gave rainbow "oil slick" rings — technically correct, aesthetically cheap. The loop seam differed in 22 % of pixels:
the half-turn symmetry only holds about the ring's own axis, but it was spinning about the world axis after the tilt. On phones the
stepped-back camera pushed the ring beyond the ray-march cutoff and it disappeared.

**Changes and why.** Camera pulled back; plate moved clear. Film thickness capped (~400 nm) to keep second-order golds, magentas and
teals. Spin moved into the ring's own frame (the seam is now one frame of motion, 0.02 % of pixels) — it also reads better, like a wheel
turning. The ray-march range now follows the camera distance. The `?white` test was run: the bare form holds as sculpture.

**Unresolved.** The softbox reflections still produce small saturated patches at grazing angles. Only s-polarisation; no
inter-reflection. Floor contact shadow is subtle.

## 11 — Light Through Glass

**First version — problems.** The glass looked like grey metal: a slope-based shadow darkened the entire interior of the rod and
lens, and the body tint was too heavy. The caustic term was two orders of magnitude too small to see, so the "light composition"
scene was just a dimmer poster. On phones the rod was visible in the opening frame.

**Changes and why.** Shadow now only on steep rims; lighter tint; rims lit on one side and dark on the other. The caustic was rescaled
and sharpened (a power curve) so focused light concentrates. The darkening goes to 16 % ambient, which turns scene IV into a composition
of light shapes and negative space. Portrait got its own entry track.

**Unresolved.** In the dark scene the rod and lens glow almost uniformly rather than forming thin focal lines — the curvature model is a
broad approximation. Material authenticity is the weakest of the six.

## 12 — Time as Material

**First version — problems.** The record was too faint to read as a structure, and the figure of eight carried the bar off the bottom
of the frame. The bar's rotation did not close (1.5π for an undirected bar), which would have broken the loop.

**Changes and why.** Rotation set to 3π (one and a half turns — an undirected bar returns to itself). Path tightened. Strobe interval
shortened to 0.11 s with every fifth slice heavier; exposure strengthened in sepia against silver slices, so the two techniques separate tonally.

**Unresolved.** At the widest memory the oldest third of the record is very faint. The caption is the only typographic element; the piece
leans entirely on the drawing.

---

## Technical checks (all executed)

- Functional suite, final run after all fixes: **148 / 150 passed** at 1440 × 900 + 390 × 844 (reduced motion). Both failures are
  timing artefacts of headless software rendering, each re-checked separately:
  *10 — loop wraps past the end*: the ray-marcher runs at ~1 fps in software GL and the player's 100 ms frame cap advanced the clock only
  ~0.1 s in 0.9 s; on the GPU the same check passes (playing, t = 0.58 after the wrap).
  *08 — once-mode ending*: frames were starved late in the long scripted sequence (t only reached 13.82 of 14); run on its own, playback
  stops at t = 14.00 with the button reading *Replay*. 10's once-mode ending was confirmed the same way.
  An earlier run, before the 08/10 seam fixes, scored 149 / 150 (only the 10 wrap failed).
- Loop seam (t = 0 vs t = D − 0.01, pixels differing by > 40/255): 07 0 %, 08 0 %, 09 0 %, 10 0.019 %, 11 0 %, 12 0 %.
- GPU frame times (GTX 1050 Ti, 1440 × 900, DPR 1): all six median 16.7 ms.
- Catalogue: no console errors, no horizontal overflow at 1440 and 390 px; every link and thumbnail resolves.
- Not tested: Safari, Firefox, real mobile devices, high-DPR GPU performance, screen readers.
