# Motion Studies — Vol. 02
## The Materiality of Motion

Six motion posters, numbered 07–12, and a catalogue page. Like Vol. 01, every piece is a static HTML
page with its own script: no build step, no libraries. The shared kit, [`shared/motion.js`](shared/motion.js),
is a copy of the Vol. 01 player (deterministic timeline, controls, keyboard, idle fade, reduced motion, visibility)
plus a small WebGL helper. Vol. 01 is untouched apart from a single link to this volume in its header.

| # | Work | Path | Length | Medium |
|---|---|---|---|---|
| — | Catalogue | [`index.html`](index.html) | — | HTML / CSS |
| 07 | Liquid Typography — *The Dissolution of Language* | [`07-liquid-typography/`](07-liquid-typography/index.html) | 16 s | WebGL |
| 08 | Elastic Letterforms — *The Physics of Expression* | [`08-elastic-letterforms/`](08-elastic-letterforms/index.html) | 14 s | Canvas 2D |
| 09 | Paper Engineering — *The Memory of a Fold* | [`09-paper-engineering/`](09-paper-engineering/index.html) | 20 s | CSS 3D + Canvas 2D |
| 10 | Iridescent Sculpture — *The Color of Changing Light* | [`10-iridescent-sculpture/`](10-iridescent-sculpture/index.html) | 20 s | WebGL ray marching |
| 11 | Light Through Glass — *An Optical Poem* | [`11-light-through-glass/`](11-light-through-glass/index.html) | 18 s | WebGL |
| 12 | Time as Material — *The Shape of What Remains* | [`12-time-as-material/`](12-time-as-material/index.html) | 20 s | Canvas 2D |

Review key frames are saved in [`keyframes/`](keyframes/); the review itself is in
[`ART-DIRECTION-REVIEW.md`](ART-DIRECTION-REVIEW.md).

**Dependencies:** none at runtime beyond Google Fonts (SIL OFL): Fraunces, Bodoni Moda, EB Garamond,
Cormorant Garamond, Inter Tight, Noto Serif TC. Without a network the pieces run with system fonts.

**Player, shared by all six:** Play / Pause, Restart, scrubber, Loop / Once, notes, Fullscreen, back to the catalogue;
`Space`/`K`, `R`, `L`, `←`/`→` (`Shift` = 0.1 s), `Home`/`End`, `F`, `I`, `Esc`. `?t=12.5` opens paused at a time.
With `prefers-reduced-motion: reduce`, a piece opens paused on its poster frame with a note.

**Determinism.** Every piece renders as a pure function of time. None of them carries state between frames:
the physics of 08 is a sum of closed-form damped oscillators, the folds of 09 are matrices of hinge angles, and the "memory"
of 12 is recomputed from the moving bar's pose function rather than kept in a feedback buffer. Scrubbing, pausing and looping
therefore always show the same frame for the same time. No fixed-step simulation or snapshotting was needed.

---

## 07 — Liquid Typography

- **Concept.** A word that names a state of matter is asked to change state. "solid" begins as print, turns wet, drips,
  fuses with itself, loses its counters, and re-solidifies as "liquid" standing on end along the page edge.
- **Design rationale.** The liquid is a property of the *letters*, not an effect on an image: the type is converted
  into an exact signed distance field and the drawn edge is the zero contour of a field that is warped, extended
  downward column by column (drips), inflated (fusion) and interpolated toward the second word. During the morph,
  the first word's field is carried into the second word's frame (moved, turned a quarter, stretched), so the body visibly travels.
- **Colour.** Milk-white paper `#F1ECE2`, a warm coffee-black ink `#2B1A12`, and a cream meniscus highlight. Nothing else.
- **Typography.** Fraunces Black (soft display serif) for the word; Fraunces italic and Inter Tight for two dictionary
  definitions, wiped in and out with the layouts.
- **Composition.** A: the word enormous and low-left, the definition beneath it. B: the word stood vertically at the right
  edge, a column of ink against an empty page.
- **Timeline (16 s).** I Legibility 0–3 (matte, paper-tooth edge) · II Softening 3–6 (gloss arrives *before* movement; first drips)
  · III Dissolution 6–10 (long drips, fusion, warp) · IV Reconstitution 8–12.6 (turns and re-forms as "liquid", drips retract)
  · V Resolution 12.6–14.6 (matte again) · loop 14.6–15.8, a fast inOutExpo freeze back to "solid".
- **Technique.** Felzenszwalb exact Euclidean distance transform on the CPU for each layout (once per resize); a fragment shader
  with a 22-sample swept drip union using a polynomial smooth-min; meniscus highlight with an analytic profile and an edge
  direction from wide finite differences.
- **Performance.** Rendered at device-pixel ratio capped at 1.5; the drip loop exits early in columns with no drip.
- **Known limitations.** The field is 8-bit, so a faint texture can remain inside counters that are closing during peak
  dissolution. Mid-morph frames (≈10 s) are intentionally illegible.

## 08 — Elastic Letterforms

- **Concept.** Typography as a physical body. The word is *tension*; the force that enters it comes from inside it — the dot of the i.
- **Design rationale.** A high-contrast Didone is a heavy stem and a hairline in every letter, which makes "mass and spring"
  legible. The outlines are traced from the real glyphs (marching squares at 1000 px so the hairlines survive) and deformed per point.
- **Colour.** Cadmium yellow `#F3C318` ground, black `#111`. A thin black string is the baseline.
- **Typography.** Bodoni Moda Black, lowercase. One line on wide screens; on tall screens "ten / sion" on two strings, much larger.
- **Composition.** The word sits low on its string; the space above belongs to the dot's flight.
- **Timeline (14 s).** I Equilibrium 0–2.8 · II Force: the i crouches, the dot leaps (2.8–3.85) · III Propagation: the dot lands on t
  and hops letter by letter; each letter squashes, rebounds and sways, neighbours answer later and weaker · IV Oscillation: the dot
  rebounds off the page edge and strikes the last n from the side, a bend runs back through the word (6.6) · climax at 7.92: the dot
  drops home and all seven letters are thrown upward in unison · V Recovery to exact rest by 13.7.
- **Technique.** Each strike is an impulse; each letter has a stretch mode that lags toward its top, a sway mode, and a local dent.
  Displacement = Σ damped sinusoids `e^(−ζωτ)·sin(ωτ)`, with propagation delay by distance. Modes are evaluated per frame in 48 height
  bands per letter and interpolated, so ~12,000 outline points stay cheap. The dot rides the i's deformed top while at home.
- **Known limitations.** Stretch is applied along the letter's height, not by true stroke thickness; Bodoni's hairline serifs show
  as thin lines extending slightly beyond the stems (they are the font's own hairlines).

## 09 — Paper Engineering

- **Concept.** 尚未寄出的信 — *a letter not yet sent*. Paper as architecture, typography as surface, motion as unfolding.
- **Design rationale.** The sheet is four panels on three creases, each panel two real 3D faces. The front is a letter (title,
  two columns, a moon drawn across the third crease); the back carries four characters, 寄 不 出 去, "could not be sent", and a postmark
  that sits exactly behind the moon — on the reverse, the same circle cancels the first character.
- **Colour.** Paper `#F2EDE3` with generated fibres, sumi ink `#23201C`, postal indigo `#34406B` for postmark and stamp; a linen-grey table.
- **Typography.** Noto Serif TC (title, the four characters), EB Garamond (the letter), Inter Tight (folios).
- **Two fold systems.** (1) A **gate fold**: the outer panels close over the inner ones in turn, revealing 去 and 寄 — go, send — out of order.
  (2) A **concertina (orihon)**: the gates swing back through flat into a zigzag; the sheet stands up and turns around to reveal 寄不出去.
- **Timeline (20 s).** I Flatness 0–2.9 · II First fold 2.9–6.4 (anticipation lift, then each gate) · III Spatial expansion 6.4–9.6
  (zigzag, stand) · IV Revelation 9.6–13.2 (turn) · V Unfolding 14.4–16.8 (lies down face-down: the flat sheet now reads the other way)
  · loop 18.3–19.85: turned over like a page.
- **Technique.** CSS 3D with `DOMMatrix` chains computed per frame (hinge rotations about panel edges, lift about the bottom edge,
  turn about the crease direction, centring on the folded bounding box). Back faces use `backface-visibility` and slice the back
  artwork in mirrored order, so no text is ever mirrored. Per-face shading from the normal against one light; crease gradients scale
  with fold angle; the table shadow is the panels' corners projected along the light into a canvas, blurred by height.
  Tall screens use a vertical chain with horizontal creases (a louvred relief rather than a standing screen).
- **Known limitations.** Paper has no visible edge thickness and no bending between creases (panels are rigid). Mid-turn
  frames briefly show the sheet nearly edge-on.

## 10 — Iridescent Sculpture

- **Concept.** Colour as a function of light, surface and time. A ribbon of constant thickness bent into a ring with one full twist
  — the simplest form that shows front and back together — carrying a transparent film.
- **Optics vs. art.** *Physical:* two-interface Airy reflectance of one film (n = 1.38) on a substrate (n = 1.6), s-polarised, refracted
  angle from Snell's law, evaluated at seven wavelengths (410–650 nm) and integrated to RGB with the CIE 1931 observer (Wyman fit),
  normalised so a flat spectrum is white. *Artistic:* the film-thickness field (a swirl plus gravity drainage), the studio
  (two soft boxes), a grazing-angle boost of the reflection, and mild tone mapping. The body under the film is neutral grey.
- **White test.** Add `?white` to the address: the same form in matte white with no film. It holds as sculpture.
- **Composition.** Ring left of centre on wide screens, tilted into a diagonal; a small plate at right reports film thickness.
- **Timeline (20 s).** I Still object (70 nm, nearly colourless) · II Light shift 3–7 · III Surface motion 7–12.5 (twist phase, width wave)
  · IV Chromatic climax 11–15 (thickest film, drainage stripes) · V Quiet resolution 15–20. The ring makes half a turn about its own axis
  per loop and the light one full circuit, so the loop closes exactly.
- **Technique.** Ray-marched SDF (128 steps, 0.55 step factor for the twist's distortion), central-difference normals, contact
  occlusion on the floor from the SDF. DPR capped at 1.25.
- **Known limitations.** At its thickest the film shows second- and third-order colours that can read as "oil slick"; thickness is
  capped at ~400 nm to keep the palette refined. Only s-polarisation is modelled.

## 11 — Light Through Glass

- **Concept.** Refraction as graphic design: three pieces of glass re-compose a printed page, then the light they gather becomes the composition.
- **Design rationale.** The poster (three words, a ruled block, a black disc, one cobalt field, a caption) is printed into a texture
  once per resize. Glass is three thickness fields — a rod (half-cylinder), a prism (wedge), a plano-convex lens — and every optical
  effect is derived from them: refraction follows the thickness gradient; dispersion scales that offset per channel (0.955 / 1 / 1.05);
  the caustic on the paper follows the glass curvature (a Laplacian) displaced along the light; rims are bright on the lit side, dark
  on the other; the glass body is a faint green-grey in proportion to thickness.
- **Colour.** Stone paper `#E7E3DB`, ink, cobalt `#2F4FA2`.
- **Timeline (18 s).** I Clear composition 0–2.4 · II Interference: the rod slides in and settles on the headline (2.4–5.1) · III
  Refraction: the prism drops onto the ruled block (5.2–8.2) · IV Light composition: the lens rises, the room darkens to 16% and only
  focused light remains (9.4–12.9) · V Departure: the glass leaves, the page returns unchanged (12.9–15.6).
- **Known limitations.** Single-bounce screen-space approximation: no internal reflection, no true focusing distance; the caustic
  is a curvature model, not a photon simulation.

## 12 — Time as Material

- **Concept.** Duration, memory and accumulation, after Marey's chronophotographic plates. A single bar of light moves through a
  figure of eight; the plate keeps its past, builds a structure, and forgets oldest-first.
- **Three techniques, one record.** A memory window decides how much of the past survives; inside it: **continuous trails** of
  the two ends (sampled at 90 Hz), **discrete slices** of the whole bar at fixed moments of absolute time (every 0.11 s, every fifth
  heavier, so slow passages crowd and speed becomes density), and **layered exposure** — light accumulated between consecutive
  slices with additive blending. They enter in that order and leave together.
- **Colour.** Umber-black plate `#12100D`, silver `#E2D8C4`, a sepia exposure. Cormorant Garamond italic for one caption that reports
  how much time the plate currently holds.
- **Timeline (20 s).** Presence 0–2.6 · Movement 2.6–5 · Memory 5–9.4 · Accumulation 9.4–14 · Dissolution 14–17.4 (the window shrinks
  faster than time advances) · Renewal 17.4–20 (the bar settles where it began; its pose function returns exactly to its start).
- **Technique.** Canvas 2D; no frame buffer. At time t the record is recomputed from the pose function over [t − window, t].
  Memory is bounded: at most ~650 trail samples per end, ~65 slices and ~65 exposure quads per frame.
- **Known limitations.** At the widest window the record is thin by design; on very bright screens the oldest traces are close to invisible.

---

## Performance

Measured on an NVIDIA GTX 1050 Ti through Chromium/ANGLE (D3D11), 1440 × 900 at device pixel ratio 1:
**all six run at 60 fps** (median frame 16.7 ms, p95 ≤ 16.8 ms, at most one frame over 25 ms in 180).
Not measured at high DPR or on mobile hardware; 07 and 10 are the heaviest shaders and are capped at DPR 1.5 and 1.25.

## Accessibility

Each stage has a text description; controls are named buttons with state, a polite live region announces playback,
the keyboard covers everything, the UI never fades while focused, and reduced motion opens on a still. No piece flashes;
the darkening in 11 is a 1.6 s fade.
