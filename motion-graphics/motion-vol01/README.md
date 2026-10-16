# Motion Studies — Vol. 01
## The Poetry of Moving Forms

Six experimental motion posters and a catalogue page. Each piece is a static HTML page with its own
script; there is no build step and no animation library. The pieces share one small kit,
[`shared/motion.js`](shared/motion.js), which provides a deterministic timeline player and a handful of math helpers.

| # | Work | Path | Length | Medium |
|---|---|---|---|---|
| — | Catalogue | [`index.html`](index.html) | — | HTML / CSS |
| 01 | Typographic Choreography — *The Architecture of Moving Letters* | [`01-typographic-choreography/`](01-typographic-choreography/index.html) | 18 s | Canvas 2D |
| 02 | Geometric Ballet — *A Choreography of Pure Forms* | [`02-geometric-ballet/`](02-geometric-ballet/index.html) | 20 s | Canvas 2D |
| 03 | Living Editorial — *A Magazine That Refuses to Stay Still* | [`03-living-editorial/`](03-living-editorial/index.html) | 27 s | HTML / CSS + painted canvases |
| 04 | Moiré Kinetics — *The Geometry of Optical Interference* | [`04-moire-kinetics/`](04-moire-kinetics/index.html) | 32 s | WebGL fragment shader |
| 05 | Controlled Chaos — *The Emergence of Order* | [`05-controlled-chaos/`](05-controlled-chaos/index.html) | 24 s | Canvas 2D |
| 06 | Typographic Sculpture — *Letters Beyond the Plane* | [`06-typographic-sculpture/`](06-typographic-sculpture/index.html) | 30 s | Canvas 2D, projected glyphs |

Open `index.html` directly (`file://`) or from any static server. Fonts come from Google Fonts
(all SIL Open Font License); without a network connection the pieces fall back to system fonts and
still run, but lose their typography.

---

## The player (shared by all six)

- **Time is the only state.** Every piece exposes `render(t)`, a pure function of the timeline position.
  The player owns the clock (`requestAnimationFrame` deltas, clamped to 100 ms), so speed does not
  depend on refresh rate, scrubbing is exact, and the same `t` always gives the same frame.
  Anything that looks random uses a fixed seed (`Motion.rng`) or deterministic Perlin noise (`Motion.noise3`).
- **Controls:** Play / Pause, Restart, timeline scrubber, Loop / Once, Info, Fullscreen, back to the collection.
  Keyboard: `Space`/`K` play-pause, `R` restart, `L` loop, `←`/`→` step 1 s (`Shift` = 0.1 s), `Home`/`End`, `F` fullscreen, `I` notes, `Esc` close.
- **Idle fade:** the interface fades after 2.6 s without input while playing, and comes back on any pointer
  movement, touch, focus or key. It never fades while focus is inside it or the notes are open.
- **Loop:** every piece is choreographed so that its last frame flows into its first; there is no reset cut.
  With Loop off, playback stops on the final frame and the button offers *Replay*.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, a piece opens paused on a representative
  poster frame, with a note; the viewer can still choose to play it.
- **Visibility:** no frames are requested while the tab is hidden; the clock does not advance in the background.
- **URL:** `?t=12.5` opens paused at that time (used for stills and testing). On 04, `?grab` keeps the WebGL
  drawing buffer so screenshots can read it.
- `window.__motion` exposes `seek / play / pause / restart / setLoop / t / playing / duration` for testing.

---

## 01 — Typographic Choreography

**Concept.** In Japanese, 間 (*ma*) is the interval between two things: the gap in a room and the pause in
music are one word. The character is a gate, 門, with the sun, 日, inside it — architecture and time in one sign.
The piece asks how letters create different spatial structures as they move, and answers by building 間.

**Artistic references.** Japanese editorial modernism and exhibition posters; Swiss asymmetric layout with
dictionary-style micro typography; kinetic typography where letters behave as structural members.

**Visual system.** Paper `#ECE9E2`, ink `#141414`, one vermilion `#DB4227` — the sun, and only the sun.
Noto Sans JP Black for the gate and sun, Archivo (variable; Bold and Extra-Condensed Black) for SPACE and TIME,
Noto Serif JP for the vertical line 「文字は、時間の中に建つ。」, Inter Tight for micro type.
Ink is drawn with `xor`, so wherever black crosses black it cancels back to paper: collisions *cut* instead of piling up.

**Motion system.** Five movements over 18 s.
I *Silence* — only the red seed breathes once; a definition of *ma* sits in the corner.
II *Entrance* — the gate's two halves arrive from opposite edges (bottom, then top: counterpoint) with a small overshoot; SPACE slides out from behind the left pillar, leading letter first.
III *Collision* — the halves pass through each other and knock holes in one another; enormous extra-condensed TIME crosses from the left and decelerates; SPACE breaks into a staircase; the seed is stretched into a red lintel.
IV *Recomposition* — the halves lock; SPACE and TIME fold into a caption justified to a single width; the lintel contracts and drops into the gate as the sun (spring, then a shutter that opens the glyph's counters).
V *Resolution* — the finished poster holds; then a coda reverses the build with different (accelerating) easings so it returns to silence.

**Key compositions.** A at ~5.5 s (pillars at the edges, a word in the void, a dot); B at ~8.6 s (dense collision);
C at ~13.9 s (the finished 間 poster).

**Technique.** Canvas 2D. Glyph ink bounds are measured with `measureText` so the gate can be split exactly on its axis
and the sun placed inside it. Layout is recomputed for wide, near-square and tall frames.

**Performance.** One canvas, ~20 text draws per frame; ~0.5 ms per frame in software rendering; 60 fps on a GTX 1050 Ti.

**Known limitations.** Canvas `extra-condensed` relies on the browser matching Archivo's width axis through `font-stretch`;
a browser that ignores it will set TIME at normal width (wider, still correct). The collision frame is intentionally dense.

## 02 — Geometric Ballet

**Concept.** Can pure geometry have character and emotion without any figure or story? Four characters, one
rule each: the **circle** is fluid and never stops abruptly; the **rectangle** is decisive — it falls and stays;
the **line** reaches across and carries vibration; the **arc** orbits until it finds its place.

**References.** Bauhaus and Concrete Art (Max Bill's rules-first composition), abstract animation, Kanizsa's illusory contours.

**Visual system.** Deep viridian ground `#1B3530` with a darker stage floor below the horizon, cream `#EEE6D2`,
persimmon `#E0673A`, pale blue `#9DBDC9`. A 1000-unit artboard; the horizon and the line run full-bleed.
A small programme of act titles sits on the floor.

**Motion system — every movement is caused by a previous one.**
Act i, *the cut*: a line draws across and vibrates; a pause; the disc's halves breathe in and part along the cut's
normal, **revealing a slab that was hidden inside the disc** (surprise 1). The halves roll down on separate curves and become
domes; the line rotates upright into an axis; only then does the slab fall into the gap, and its impact rings
the ground and the line.
Act ii, *the lock*: the impact sets four arcs chasing at different speeds and numbers of turns; each clicks in on its
own beat and **they close into a perfect ring** around the space where the disc used to be (surprise 2).
Act iii, *the absent triangle*: three notched discs rise through the horizon, spin, and settle with a spring until their
notches agree — **a triangle nobody drew appears**, and it is opaque enough to interrupt the line behind it (surprise 3).
Return: wedges turn away, discs sink, arcs unlock and stack, the domes rise and reseal the disc over the slab, the line withdraws.

**Technique.** Canvas 2D; the horizon and line are polylines displaced by decaying travelling waves keyed to impact times.

**Known limitations.** The Kanizsa effect is weaker at phone size, where the discs are small. The halves overlap briefly
in mid-air on their way to the floor.

## 03 — Living Editorial

**Concept.** If a carefully designed magazine spread were alive, how would it re-edit itself? *Hours — A Journal of
Ordinary Light*, No. 07, runs a feature, “Gathering Light / 光的採集”: a year spent photographing the light that falls
through one north window at 4:12 in the afternoon. The theme runs through the text, the pictures, and the layout:
the time 4:12 itself becomes the largest image in the third layout.

**References.** Japanese art books and photography magazines, cultural exhibition catalogues, poetic modernism.

**Visual system.** Paper `#F3EFE6`, ink, one sienna `#9A4B2C` for the drop cap, kicker and column guides.
Instrument Serif (display, roman and italic), Newsreader (body), Inter Tight (captions, folios), Noto Serif TC (vertical text).
Three photographs — a window patch with branch shadows on plaster, a sea horizon after rain, a glass of water whose shadow
holds a caustic crescent — are **painted at load time** from soft light, shadow and grain with fixed seeds; there are no image files.

**Motion system.** Three complete layouts (spread opening / panorama across the gutter with the headline crossing it /
still life with the numeral) with holds of 4–5 s, and transitions of 4.2 s that always follow the same editorial order:
pictures are re-cropped first (clip-path masks and image focal points), then the headline, then the columns, then captions.
Type that leaves is wiped away before anything moves; type that arrives is set only once the page has settled.
The column grid surfaces briefly in sienna during each re-edit, like a layout table showing through.
A separate single-page portrait edition has its own three layouts.

**Technique.** DOM and CSS: per frame, only `transform` and `clip-path` are written (no layout reads), so the browser
composites and repaints but never reflows. The spread is a fixed artboard scaled to fit; the portrait edition is a different composition, not a squeezed spread.

**Known limitations.** Text columns keep their width between layouts (they move, they do not reflow). On a phone the body
text renders at roughly 9–10 px — legible, but small; the piece is meant to be seen, then read on a larger screen.
The painted photographs are soft and illustrative rather than photographic.

## 04 — Moiré Kinetics

**Concept.** How can the simplest, most precise order produce images that look organic and complex? Two transmission
gratings of light lie one over the other, and light passes where both are open. No wave in the image is drawn.

**References.** Op Art, kinetic art, optical bench instruments, precision printmaking.

**Visual system.** Graphite `#0D0E10` and ivory light `#E8E2D2` only. The gratings sit inside a circular plate with a graduated dial;
two pointers on the dial show the two gratings' orientations, reticles mark the centres once they are on the plate, and a
plate caption lists the three structures and reports Δθ, separation, curvature and zone-plate mix live.

**Motion system.** 32 s, slow throughout. Structure I: two sets of straight lines, rotated by under four degrees — broad
bands swing perpendicular to the motion. Structure II: each grating bends into concentric circles as its centre arrives
from infinity; two orbiting centres produce families of curved fringes. Structure III: the circles tighten into zone plates
(phase ∝ r²), and two offset zone plates produce **straight** fringes that rotate with the offset. Then everything relaxes back to coincident lines.

**Technique.** One full-screen WebGL fragment shader. Each grating is a single phase field that morphs continuously
line → circle → zone plate (the circle term uses a numerically stable form that tends to the line as the centre recedes).
Stripes are **box-filtered analytically**: the shader uses the antiderivative of the square wave and the analytic gradient of
the phase to integrate each stripe over one device pixel's footprint, falling back to the mean where a stripe is finer than a pixel.
This prevents the screen's own sampling from manufacturing moiré. Rendered at device pixel ratio (cap 2); the period scales with the plate.

**Known limitations.** High-frequency imagery is inherently intense; motion is kept slow and there is no flashing, but
viewers sensitive to patterns should use the reduced-motion still. Thumbnails of this piece must be made at display size —
any downscale creates false moiré.

## 05 — Controlled Chaos

**Concept.** A precise system starts to err. Can a new aesthetic order emerge from the error? A grid of dots on
ultramarine is disturbed at one point — the golden section — and resolves, through turbulence, into a sunflower.

**References.** Concrete and systems art, phyllotaxis, phase transitions.

**Visual system.** Ultramarine `#1E2EA6`, bone `#F0ECE2`, one signal yellow `#F2C230` used only for the origin, the passing
wave front, and two Fibonacci spiral arms (21 and 34) that exist only in the spiral state. A corner plate names the phase and
draws the order parameter (mean displacement from the grid) across the whole loop, with the present moment marked.

**Motion system.** I *Perfect order* (still) → II *Disturbance*: the origin dot draws a breath; a wave front leaves it
→ III *Propagation*: behind the front a radial ripple and a curl-noise field grow → IV *Emergence*: inner dots first,
every dot takes its seat on Vogel's spiral; the spiral turns slowly → V *Return*: not a rewind but a different procedure — a left-to-right scan
lifts each dot back into its cell with a spring.

**Technique.** Canvas 2D, one batched path per colour. Curl noise (from deterministic Perlin noise) is divergence-free,
so dots swirl around each other instead of clumping. The grid → spiral assignment is an **equal-area mapping**: dots ranked by
distance from the origin receive the matching spiral index, so each one mostly turns rather than travels.

**Known limitations.** The midpoint of the emergence (~12–13 s) is the least composed moment. In landscape the spiral bleeds off the
top and bottom edges by design.

## 06 — Typographic Sculpture

**Concept.** When type is no longer attached to a plane, what relationship forms between letters and space?
The phrase LETTERS BEYOND THE PLANE, repeated to 240 letters, is used as building material.

**References.** Spatial typography, minimalist sculpture, architectural form studies.

**Visual system.** Warm studio grey `#D8D5CE` and black type only, Archivo ExtraBold. One light direction: front faces
take their tone from it, back faces turn pale, distance adds air; a soft floor shadow grounds the object. A small caption names the three structures.

**Motion system.** Three structures — a **helix tower** read upward; a **Möbius band** of four lines whose half-twist keeps
rolling, so the text is always passing from front to back; a **field**, twelve lines lifted into a travelling swell —
each held 5–6 s, with 4 s transitions in which the letters leave one after another along the text, so a transition reads like a sentence.
The camera rises as the sculpture flattens and makes exactly one orbit per loop.

**Technique.** Canvas 2D, no 3D library. Every glyph is a plate with a frame (position, reading direction, up). Three corners are
projected in perspective and the glyph is drawn through the affine map they define; glyphs are depth-sorted every frame. Glyph images
come from a pre-rendered atlas in 14 tones, so shading never needs per-pixel work. Proportional spacing is computed from real advance widths.

**Known limitations.** Each glyph is affine inside its own plate (perspective is exact at its corners only); at this glyph
size the difference is not visible, but it would be on very large letters. Back faces read mirrored, by design. The middle of the Möbius → field transition (~19 s) is busy.

---

## Performance considerations

- Time-based animation; frame delta clamped; nothing advances while the tab is hidden.
- Canvas sizes follow the element at device pixel ratio capped at 2.
- No per-frame allocation of DOM nodes; 03 writes only `transform` / `clip-path`; 05 batches all dots into two paths;
  06 draws from one atlas; 04 is a single draw call.
- Measured on a desktop GPU (NVIDIA GTX 1050 Ti, Chromium, 1298 × 1222 px): **all six hold 60 fps** (median frame 16.7 ms, p95 ≤ 17.2 ms).

## Accessibility

- Each stage has a text alternative describing the piece; 03's text is real, selectable HTML.
- All controls are buttons with names and state (`aria-pressed` for loop, `aria-expanded` for notes); a polite live region announces Playing / Paused / Ended / Loop.
- Keyboard covers every control; focus is visible; the interface never fades while it has focus.
- `prefers-reduced-motion` opens each piece on a still composition. No piece flashes; 04's motion is deliberately slow.
