# MOTION STUDIES — VOL. 03

## The Illusion of Perception

[Collection](index.html) · [Pre-implementation art briefs](ART-DIRECTION-BRIEFS.md) · [Critical review](ART-DIRECTION-REVIEW.md) · [36 key frames](review/contact-sheet.png) · [Mobile sheet](review/mobile-sheet.png) · [Live-loop filmstrip](review/live-filmstrip.png)

| # | Artwork | Duration | Primary construction |
|---|---|---:|---|
| 13 | [Please remain in the picture](13-analog-signal/index.html) | 16 s | Cached type plates / analytic signal remapping |
| 14 | [An address that cannot exist](14-impossible-geometry/index.html) | 16 s | Authored vector geometry / cyclic depth patches |
| 15 | [Two inks, a third voice](15-halftone-alchemy/index.html) | 18 s | Three spot-colour screen structures / multiply |
| 16 | [Rooms for a small ensemble](16-sound-architecture/index.html) | 16 s | Original score / Canvas / Web Audio |
| 17 | [The colour between us](17-chromatic-metamorphosis/index.html) | 16 s | Constant colour swatches / changing complementary boundaries |
| 18 | [The guest is the gap](18-negative-space-theatre/index.html) | 14 s | Complementary cubic silhouettes / spatial inversion |

Run `npm run dev` from `motion-graphics-astra`, then open `http://127.0.0.1:4178/motion-vol03/`. Serve over HTTP; ES module loading from a file URL is unsupported. These are six independent motion posters, with a restrained catalogue, not an expanded interactive application.

## 13 — Please remain in the picture

**Inquiry and rationale.** An imperfect transmission can create a second image without losing its human message. STAY / WITH / ME addresses the viewer; “Do not adjust your tenderness” reframes correction as a question rather than a technical instruction.

**References.** Early video art and archival broadcasting supply a method of treating the medium itself as material. [Whitney’s Magnet TV record](https://whitney.org/collection/works/6139) and [MoMA’s Zen for TV record](https://www.moma.org/collection/works/163792) informed the distinction between controlled image alteration and decorative glitch. No image or specific artwork was copied.

**Visual direction.** Bone `#ddd9c9`, olive-black `#292e27`, muted gold `#a58e49`. Anton is the transmitted mass; Bodoni is the human aside. An asymmetrical three-block composition leaves a large charged gap. The gold echo is delayed memory, not RGB ornament.

**Motion.** 0–2 s clear transmission; 2–5 local drift; 5–8 interference; 8–12 compression into a horizon; 12–16 restoration. Three distinct operations serve different purposes: horizontal sync displacement disrupts reading, a low-opacity gold duplicate retains the previous reading, and vertical compression turns WITH into a new connecting image.

**Implementation/performance.** Canvas plates are cached on resize; a bounded scanline loop remaps them. WITH has its own plate, so its collapse cannot accidentally compress ME. No random noise, video asset, per-frame image loading or time-dependent flicker.

**Limitations.** This is an art-directed signal model, not CRT electronics emulation. Slice interpolation can reveal fine raster edges at large enlargement. The historical video vocabulary is intentionally recognizable.

## 14 — An address that cannot exist

**Inquiry and rationale.** Local depth cues can conflict with the global object. The viewer must revise an apparently reliable spatial reading.

**References.** Necker depth ambiguity, impossible-object geometry and minimalist architectural drawing are mathematical precedents. Their perceptual mechanisms are re-composed in an original editorial sequence; the underlying illusions themselves are not claimed as new discoveries.

**Visual direction.** Mineral green `#c9d3ce`, deep green `#324d47`, ivory `#faf0d8`. Light beam faces and dark side faces persuade the eye to read depth. An offset object is balanced by the large Bodoni “Elsewhere.”

**Motion.** Opening: a plausible wire-beam room. 2–4 s: near/far depth becomes ambiguous. 5–9 s: three beams impose a directed cycle A above B, B above C, C above A. 9–13 s: three round-ended prongs join two block supports. 13–16 s: the room returns. Slow spatial wipes carry the replacement between complete configurations.

**Implementation/performance.** Direct vector geometry and short locally reordered beam sections, rather than a spinning 3D scene. Low object count, no textures or GPU context. The contradictory structure deliberately has no consistent 3D mesh.

**Limitations.** Recognition depends on the viewer’s spatial interpretation. The wipe transitions expose fragments of two constructions, so their silhouettes are less resolved than the held configurations. These are authored projection paradoxes, not a navigable impossible building.

## 15 — Two inks, a third voice

**Inquiry and rationale.** The means of printing can supply the image itself. Two plates produce an overlap colour with no third plate.

**References.** Spot-colour screen printing, risograph registration and experimental printmaking, interpreted with exact edges rather than faux vintage noise.

**Visual direction.** Warm paper `#f0dfcc`, muted rose `#ad4e60`, petrol blue `#315a75`. Two planetary forms occupy the upper/right field; a large Bodoni phrase anchors the lower left. The forms are intentionally cropped by the print window.

**Motion.** 0–3 s dot-screen order; 3–6 separation; 6–9 directional line screen; 9–12 overprint; 12–15 hollow diamond lattice; 15–18 reprinting. These are distinct structures: isolated disks, continuous bent strokes and connected open cells. A density field varies smoothly at the perimeter; registration motion is slow.

**Implementation/performance.** Analytic density, 14-unit screen pitch, bounded drawing area and Canvas multiply compositing. Two colour plates are drawn at fixed relative angles. Dot/line/lattice weights transition continuously; no image or font reads occur per frame.

**Limitations.** Multiply is an RGB approximation of ink overprint, not a spectral print simulation. Fine lattice patterns can alias on low-density screens. DPR-capped rendering and slow motion reduce, but cannot eliminate, display-dependent sampling artifacts.

## 16 — Rooms for a small ensemble

**Inquiry and rationale.** A score can build an architectural composition without measuring loudness or showing a spectrum. Musical rests are active spatial intervals.

**Visual direction.** Midnight teal `#162f36`, parchment `#e4e4ce`, brass `#d8ba83`, clay `#b57051`. A receding arcade, floor accents and harmonic planes form three visual voices; the title sits in quiet upper space. The silence around the ensemble is deliberate.

**Score and choreography.** Original eight-bar miniature in 4/4 at 120 BPM, 16 seconds total. 28 rhythmic events lay short floor accents; 14 melodic notes open the arches in staggered phrases; four three-note chords form sustained planes. The final interval leaves a breath. The exact `score` array in `score.js` governs both sound and image. This is a composed score, not arbitrary motion made to resemble audio response.

**Audio implementation.** Native Web Audio was chosen because sine/triangle oscillators and one short fixed score need no Tone.js dependency. The context is not created until the Sound button is pressed. Notes are scheduled against AudioContext.currentTime; once enabled, that clock becomes the visual playback clock. Pause cancels all active/future oscillators; seek clears and rebuilds the remaining score; loop re-anchors it. A small attack avoids clicks. Partial notes resume with a new short envelope, rather than restoring oscillator phase. Muting leaves the full visual score intact.

**Performance and cleanup.** A bounded 54-event score; nodes disconnect when finished or cancelled. No FFT drives the artwork. An analyser is used only to inspect output amplitude during QA. The owner closes the audio context on page exit. [MDN currentTime documentation](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime) informed the scheduling model.

**Limitations.** Sound was verified as a non-zero, unclipped browser waveform and checked against the visual clock; no human listening or speaker/headphone evaluation is claimed. Timbres are intentionally minimal. Browser/device audio latency can differ; the scheduler does not compensate for physical speaker latency. Safari and mobile audio interruptions require separate device testing.

## 17 — The colour between us

**Inquiry and rationale.** The perceived identity of a colour depends on context. [The Albers Foundation’s Interaction of Color material](https://www.albersfoundation.org/alberses/teaching/interaction-of-color) informed the observation method, not a copied plate.

**Visual direction.** Russet `#a44832`, straw `#d4b969`, mineral `#303e39`, constant peach `#d99b74`. Broad hard edges carry the narrative. Type remains small, so the fields own the composition.

**Motion.** Three colour discoveries: identical peach squares appear different on unequal grounds; the ground areas trade dominance while the swatches retain their exact RGB value; complementary boundaries create an arch and the two swatches meet as one seamless band. 0–3 s equilibrium, 3–6 territory, 6–9 simultaneous contrast, 9–13 boundary transformation, 13–16 return.

**Implementation/performance.** Flat vector fills, exact swatch values and continuous edge geometry. The arch is the gap between the left and right masses; it is never added as a separate outlined object. No gradients, filters, textures or shaders.

**Limitations.** Perceived colour varies with display calibration and the viewer. Equal RGB values are verifiable; a particular perceptual response is not guaranteed. The piece deliberately offers slower, smaller visual discoveries than the other works.

## 18 — The guest is the gap

**Inquiry and rationale.** An absence can become the apparent protagonist when its boundaries change. A vase/profile relationship becomes a doorway, then returns to two unremarkable masses.

**References.** Gestalt figure/ground research, opposing-profile illusions and Japanese spatial restraint. The familiar vase/profile mechanism is acknowledged; the original contribution is the timed sequence, masking and editorial composition.

**Visual direction.** Only bone `#ebe5d6` and charcoal `#282d28`. Precise inward cubic contours form an absent vessel. A small Bodoni invitation stays outside the silhouette.

**Motion.** 0–2 s presence, 2–4 separation, 4–7 hidden vessel, 7–10 spatial figure/ground inversion, 10–12 an occluding lintel turns the gap into a doorway, 12–14 return. Inversion travels spatially across the image, avoiding a full-frame instantaneous polarity flash.

**Implementation/performance.** Paired complementary contours, a clipped inverse rendition and a moving solid lintel. Only a few filled paths; no image processing. Exact time reconstructs the same contour and wipe position.

**Limitations.** The opposing solids are abstract profile-like forms rather than portraits. The vase/profile vocabulary is familiar, and the mid-wipe composition is intentionally ambiguous. Perceptual interpretation remains subjective.

## Shared engineering, access and assets

- Runtime: local HTML/CSS/ES modules, Canvas 2D and optional native Web Audio. Canvas fits these flat, precisely masked compositions; no shader or 3D library is added merely to diversify the stack. Previous volumes retain their separate SVG, CSS 3D and WebGL approaches.
- Playback: absolute time, seamless start/end, Play/Pause, Reset, scrubber, Loop and Fullscreen. `?t=6.4` opens paused at an exact time. The `window.__motion` inspection API is shared with Vol. 02; the AudioContext clock is optional and does not change silent renderers.
- Keyboard: Space/K, R, L, arrows, Shift+arrows, Home/End, F. Native controls keep native semantics. Visible focus, accessible button labels, timeline values, HTML descriptions and polite playback state are provided. Sound is a separate explicitly activated control.
- Reduced motion: a representative still is the default; explicit Play starts. A preference change pauses and selects the still. Catalogue images are static.
- Responsive art direction: 1000-unit width with dynamic height; typography, geometry placement, screen extent and negative space adapt to landscape and portrait. The impossible object keeps a readable aspect ratio while its surrounding space changes. UI stays below the artwork and wraps on mobile.
- Rendering budget: Canvas backing scale is capped at 1.7. Screens use fixed pitch, signal plates cache on resize, no unbounded history or uncontrolled randomness. Hidden tabs stop rAF and audio, then re-anchor on visibility. Page exit disconnects audio nodes/context and resize observation.
- Fonts: local Anton, Bodoni Moda and Manrope, with SIL OFL texts in `../motion-vol01/assets/fonts/`. All drawing, words and the score are original code-native assets. No remote runtime fetch, stock photograph, commercial music or CDN dependency.

## Reproduction and verification

`node scripts/generate-volume.mjs 3` regenerates the HTML and pre-implementation direction record from `data.js`. Artwork code lives in `print-and-colour.js`, `space.js`, and `score.js`.

`npm run build` and `npm run lint` invoke the project’s syntax/local-reference validator. This is a static project with no TypeScript configuration or transpilation step. Browser QA uses `node scripts/qa-volume.cjs 3 --live`. Cross-volume regression uses `node scripts/integration-qa.cjs`. Playwright, Sharp and Chromium are QA-only dependencies; NODE_MODULES and CHROMIUM_PATH can select another installed runtime.

See [ART-DIRECTION-REVIEW.md](ART-DIRECTION-REVIEW.md) for the eight critical questions per work, actual refinements, scores, cross-artwork comparison and verification limits. JSON evidence is retained in `review/`. Implementation and required review artifacts are complete; universal 90+ artistic quality and physical-device performance are not claimed.
