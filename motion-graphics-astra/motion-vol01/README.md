# MOTION STUDIES — VOL. 01

## The Poetry of Moving Forms

Six independent motion posters. Original composition, procedural illustrations and choreographies; no copied artwork, video loops or external image dependencies.

| # | Artwork | Duration | Rendering |
|---|---|---:|---|
| 01 | [Interval](01-typographic-choreography/index.html) | 16 s | Canvas 2D / typography and counterforms |
| 02 | [The weight of a pause](02-geometric-ballet/index.html) | 14 s | Canvas 2D / articulated geometry |
| 03 | [An herbarium of hours](03-living-editorial/index.html) | 18 s | HTML / CSS / original SVG photograms |
| 04 | [Almost, aligned](04-moire-kinetics/index.html) | 20 s | Canvas 2D / geometric interference |
| 05 | [A tender disorder](05-controlled-chaos/index.html) | 16 s | Canvas 2D / deterministic vector field |
| 06 | [Matter / after matter](06-typographic-sculpture/index.html) | 18 s | Parametric 3D / projected glyph surfaces |

[Collection](index.html) · [Review report](review/REPORT.md) · [18 key compositions](review/contact-sheet.png) · [Mobile review](review/mobile-sheet.png) · [Live-loop filmstrip](review/live-loop-filmstrip.png)

## Operating the collection

Run `npm run dev` from the parent `motion-graphics-astra/` directory. Open the printed local URL. ES modules require an HTTP server; double-clicking the files is not a supported launch method.

Every work has Play / Pause, Reset, a time scrubber, Loop on / off, Fullscreen and collection / next-work links. The controls sit outside the artwork. Fullscreen presents the artwork alone; the keyboard remains available, and Escape restores the page. There is no audio.

| Key | Action |
|---|---|
| Space / K | Play or pause |
| R | Return to the beginning; preserve playback state |
| L | Toggle loop |
| Left / Right | Pause and seek one second |
| Shift + Left / Right | Pause and seek 0.1 second |
| Home / End | Pause at the first / final composition |
| F / Escape | Enter / exit fullscreen |

Native controls retain native keyboard behavior. Shortcuts do not intercept focused inputs, buttons or links. Accessible names, visible focus rings and a polite playback status are provided. The range control announces seconds. Artwork descriptions remain available as real HTML text.

`prefers-reduced-motion: reduce` opens a paused representative composition; explicit Play starts it. A preference change to reduce also pauses and seeks to the representative frame. Background tabs cancel the animation frame request and resume without accumulating hidden time. `pagehide` cancels animation and `pageshow` restarts it when appropriate.

Add `?t=6.4` to any artwork URL to open paused at a precise time. `window.__motion` exposes `seek`, `play`, `pause`, `restart`, `setLoop`, `time`, `playing`, `loop`, `duration` and `ready` for inspection and QA. Rendering derives from absolute elapsed seconds, never a frame counter or mutable simulation state.

## 01 — Interval

**Concept.** The blank in a word can act like a doorway in a room. INTERVAL is divided into three structural blocks; a cream threshold changes from a large unoccupied volume into a thin dividing plane. The blank is a protagonist rather than an unused background.

**Artistic references.** Asymmetric New Typography composition, Swiss alignment and the vertical/horizontal counterpoint of Japanese exhibition typography. The research informed methods of organizing space, not a recreation of a particular poster.

**Visual system.** Vermilion `#e45136`, ink `#21221b`, warm paper `#f4e9d4`. Anton supplies compact, architectural mass. Manrope carries peripheral notes. A restrained vertical Chinese label belongs to the threshold. Large letterforms, a deliberately vacant cream area and fine edge text establish three scales.

**Motion system.** Five movements: silence (0–2), entrance (2–5), collision (5–8), recomposition (8–11), resolution and return (11–16). Different word blocks lead by 0.22 s; cream cuts cross the type during collision; the middle block turns into a vertical member during recomposition. Delayed masks and a gradual return preserve the initial negative space.

**Key compositions.** 4.2 s: stacked architectural mass after the individual letter entrances. 6.4 s: a crossing cut and stepped word. 10.8 s: three separated structural members.

**Technical approach.** Canvas clipping, measured typography and nested transformations. State envelopes are quintic smoothstep curves with stationary endpoints. No glyph-image downloads.

**Performance considerations.** Only a few glyphs and rectangles are drawn per frame; no DOM layout in the render function. Font loading completes before measurement.

**Known limitations.** Text is deliberately less readable during the collision. Tiny marginal notes act as print texture on phones; the accessible HTML statement is the readable equivalent. This is typographic choreography, not linguistic analysis of the Chinese character.

## 02 — The weight of a pause

**Concept.** Weight can be conveyed through timing and a line of contact, without characters or physics simulation. A cream circle transfers an impulse to a green ring; the line carries the impulse onward to an ochre counterweight.

**Artistic references.** Concrete Art's compositional economy, Bauhaus relationships between elementary forms, and abstract animation's ability to assign temperament to geometry.

**Visual system.** Muted sage `#b6c4a7`, deep green `#173f32`, pale butter `#f3e7ba` and a small oxide counterweight `#b45c3d`. A Bodoni title contributes a quiet, curved counterpoint to the precise contact line. The principal mass sits to the right of the title.

**Motion system.** Poise (0–2), transfer (2–5), cut (5–8), counterweight (8–11), rest and return (11–14). Three authored discoveries: a solid-seeming mass reveals a void; the void becomes the separation between two scoops; two semicircles rotate into an S-like standing balance. The small circle arrives before the cut, and the rectangular counterweight responds afterward.

**Key compositions.** 1 s: ring and waiting dancer. 6.6 s: separated cups and transferred weight. 9.5 s: vertical counterweight structure.

**Technical approach.** Filled semicircles, a negative-space disk, a line and two small accents. Transformations share causal phase envelopes; there is no random motion or physics drift.

**Performance considerations.** Very small draw count. Geometry stays inside an explicit composition margin at landscape and portrait proportions.

**Known limitations.** Weight is an authored visual metaphor rather than physically simulated contact. Its restrained vocabulary intentionally leaves the longest silent holds in the series.

## 03 — An herbarium of hours

**Concept.** A botanical journal preserves an afternoon rather than a specimen. “We gathered nothing but an afternoon. The leaf is gone. The light remains.” The page rearranges the relationship between what was gathered and what can still be remembered.

**Artistic references.** Botanical contact-print imagery, Japanese art-book sequencing, cultural catalogues and asymmetric editorial grids. All plant shapes were generated from original branching and leaf geometry; no museum images were copied or downloaded.

**Visual system.** Parchment `#e9e3d5`, brown-black text, rust photogram and olive photogram. Bodoni's thick/thin strokes establish an editorial rather than interface voice. Oversized plate numbers, cropped imagery, an intimate text column and a fine baseline retain the feeling of a printed spread.

**Motion system.** Three complete layouts: Gather (0–4), Preserve (6.5–9.5), Remember (12.8–15), with transitional intervals and a composed return by 18 s. Image frames travel to new columns while the crops change at a slower rate. The headline crosses the old grid; the small copy follows into a new quiet region.

**Key compositions.** 1 s: tall fern with a smaller leaf inset. 7.8 s: left image, middle title, upper-right image. 13.8 s: large leaf plate, abbreviated fern, high plate number.

**Technical approach.** Actual HTML text, CSS container-relative type and two locally stored SVG plates. The moving grid has separate portrait and landscape key layouts, interpolated from the same timeline.

**Performance considerations.** Only the small number of participating elements receive style updates. SVG grain is static and rasterized by the browser; image transforms adjust existing surfaces. Text style writes can still require layout, so this deliberately avoids hundreds of DOM elements.

**Known limitations.** These are imagined digital photograms, not photographs or identified botanical specimens. Copy is deliberately brief. During recomposition, image/title overlap is intentional; minor text remains in quiet regions at the three final layouts.

## 04 — Almost, aligned

**Concept.** Two precise orders create an image that belongs to neither layer. The apparent surface is an emergent consequence of geometric difference.

**Artistic references.** Op Art, kinetic interference and precision printmaking. The work uses actual superposed line structures rather than a shaded wave pretending to be interference.

**Visual system.** Sulfur `#d4da6a` and dark olive `#283327`. Compact uppercase Anton, a tracked Manrope subheading, thin measuring marks and a circular aperture. This is the most severe, optical voice in the collection.

**Motion system.** Three structures occupy the same aperture: parallel lines with changing relative angle (0–5.2), displaced concentric rings (6.8–10.9), and offset radial line fans (12.8–17.2). Slow crossfades occur only between the geometries. Position and angle oscillate periodically and return exactly at 20 s.

**Key compositions.** 3 s: woven-looking linear field. 9 s: ring interference. 15 s: radial petal / vortex structure.

**Technical approach.** Canvas paths clipped to a shared aperture. Each image consists of two explicitly drawn geometric families. A quiet disk masks the dense radial singularity. The apparent waves come from overlap, not a pre-rendered texture.

**Performance considerations.** Pixel spacing adapts to the CSS width (at least approximately 3.2 CSS pixels between base lines); stroke width follows spacing. Device pixel ratio is capped at 2. Radial count is bounded. Retina screenshots are included in the review.

**Known limitations.** Moiré is intrinsically sensitive to display sampling and screenshot resizing. Its contrast pattern can differ between screens. Reduced motion is respected, but sensitivity to optical art varies individually; pause and scrub remain available. Hardware display comfort requires human confirmation.

## 05 — A tender disorder

**Concept.** Error is allowed to travel without destroying the boundary of a system. Local phases become a collective current, while fixed edge conditions remember the original order.

**Artistic references.** Generative drawing, textile-like fields, wave propagation and deterministic phase systems. The marks are conceived as a graphic material rather than particles with individual stories.

**Visual system.** Slate `#262f40`, warm salmon `#e7a794` and a small amount of muted blue-gray. The matrix changes from 39 × 26 marks in landscape to 39 × 43 in portrait. Light and heavy Manrope title weights echo fragile marks and recovered order.

**Motion system.** Order (0–2), localized disturbance (2–4), propagation (4–7), emergence (7–12), return (12–16). A distance-dependent wavefront activates each point. An angular/radial curl and a sinusoidal field combine into a broad current. A boundary envelope suppresses displacement at the frame. Displacement and orientation vanish smoothly at the loop seam.

**Key compositions.** 1 s: untouched field. 5.5 s: travelling disturbance. 9 s: a larger current inside the remembered boundary.

**Technical approach.** Analytic functions of normalized position and absolute time. No `Math.random()`, random seed resets or numerical integration. Identical time values reproduce identical marks.

**Performance considerations.** The number of marks is fixed by orientation. Each mark is one short stroked segment. Drawing is clipped to protect title and footer zones; no particles or render resources accumulate.

**Known limitations.** The attractor-like pattern is a designed analytic field, not a physical fluid or scientific chaotic-system simulation. Dense marks lose individual detail in small catalogue previews.

## 06 — Matter / after matter

**Concept.** Repeated MATTER becomes a porous typographic skin. A word's shape is allowed to compete with its ability to be read. A ring, a spiral and an open sheet ask three different questions about inside and outside.

**Artistic references.** Minimal sculpture, spatial typography, ruled surfaces and architectural form studies. Monochrome material is intentionally sufficient: no bloom, environment map, glossy shader or color spectacle supports the silhouette.

**Visual system.** Warm gray `#d7d8d1`, charcoal letters and depth-dependent opacity. Anton is the physical material; a small Manrope label leaves the sculpture in control. The camera is oblique and slightly elevated, with a low-amplitude periodic shift.

**Motion system.** Torus (0–4), transition to helix (4–6.8), helix (6.8–9.5), opening to wave surface (10.3–12.8), wave (12.8–15), return to torus (15–18). Corresponding surface coordinates interpolate continuously. Glyphs keep their identity through each change.

**Key compositions.** 1.5 s: enclosed torus with a visible central void. 7.8 s: a vertically open spiral. 13.8 s: a broad, folded sheet.

**Technical approach.** Three parametric 3D surfaces, camera rotations, perspective projection, depth sorting and affine projection of cached glyph textures into local surface tangent planes. This is actual 3D geometry rendered using Canvas 2D; it is not a spinning screenshot or extruded-text demo. There are 36 × 6 glyph tiles.

**Performance considerations.** Six glyph textures are cached. Glyph tiles are retained and sorted in place; total tile count is bounded. Projected coordinates use retained typed arrays, camera trigonometry is computed once per frame, and there are no per-vertex temporary arrays. There is no GPU context, per-frame mesh allocation or unbounded particle lifetime. Real-time cadence is measured separately from synchronous rendering stress tests.

**Known limitations.** The surface is a porous collection of flat glyph tiles, not solid extruded letter geometry. Affine tangent patches approximate curved surfaces and can visibly compress at grazing angles. Painter-order sorting is less robust than a depth buffer during self-intersection. Letter readability intentionally changes with orientation; this is the main remaining artistic/technical refinement area.

## Shared engineering

- **Clock:** `requestAnimationFrame` timestamps in seconds; hidden intervals do not advance it. Non-loop playback stops at the final state. Restart preserves pause/play intent.
- **Determinism:** each frame is a function of time, aspect and resolution. No mutable simulation history is needed to scrub backward.
- **Seam:** all envelopes return to the same values at 0 / duration; periodic functions use full periods. Pixel comparison and full real-time loops are both tested.
- **Responsive composition:** the artboard changes its logical height, geometry measures both dimensions, text sizes are bounded, the mark count adapts and the editorial piece has explicit alternate layouts. This does not apply a CSS scale to an entire desktop page.
- **Resources:** all artwork fonts, plates and previews are local. No runtime packages, CDNs, analytics, autoplay audio or external requests.
- **Resolution:** device pixel ratio and total logical canvas scaling are capped at 2; mobile geometry is sampled at a manageable density.
- **Lifecycle:** one animation loop per artwork; paused and hidden pages cancel it. The catalogue uses static WebP previews, so it does not run six animations at once.
- **Static build:** `npm run build` / `npm run lint` check syntax and references. Browser behavior is verified separately; a successful static check is not used as an aesthetic verdict.

## Sources and licenses

The research used [MoMA — The New Typography](https://www.moma.org/calendar/exhibitions/1013) for asymmetric page organization, [MoMA — Bauhaus graphic design](https://www.moma.org/explore/inside_out/2009/11/06/bauhaus-the-graphic-design-department-goes-back-to-school/) for the relationship between type and elementary form, and [MoMA — Photogram](https://www.moma.org/collection/terms/photogram) for the contact-print medium. These are contextual references; no source image or composition is reproduced. Tate's Op Art page could not be fetched and is not presented as a reviewed source.

Anton, Manrope and Bodoni Moda are redistributed under the SIL Open Font License. Their original license files are included in `assets/fonts/`. Fonts were downloaded from the [Google Fonts source repository](https://github.com/google/fonts). `Bodoni` is the local CSS family alias for Bodoni Moda. Both botanical SVGs are original procedural illustrations generated by this project.

## Verification and limits

See [the review report](review/REPORT.md), [automated browser results](review/verification.json) and [real-time playback measurements](review/playback.json). Screenshots document actual Chromium rendering. Full cycles were executed and sampled, with the resulting filmstrip visually reviewed; this is not equivalent to a human continuously watching every frame on a calibrated display. Safari, Firefox, real phones, 120/144 Hz hardware, screen-reader sessions, long-duration heap profiling and external curatorial assessment remain unverified.
