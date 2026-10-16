# Delivery / art-direction review

Date: 2026-10-16 (Asia/Taipei). Branch: `codex/motion-graphics-astra`.

## Completion status

**Completed:** six independently browsable motion posters, collection catalogue, responsive compositions, original botanical plates, locally licensed fonts, deterministic timeline controls, reduced-motion behavior, browser QA, visual refinement and documentation. All new files are contained in `motion-graphics-astra/`. The initially untracked `motion-graphics/motion-vol02/` directory is preserved. During this work, an external change advanced HEAD to `f036058` and those files became tracked; that commit was retained. This delivery stages only the new `motion-graphics-astra/` directory.

**Partially achieved:** the aspiration that all six works merit 90+ under the supplied artistic rubric. The internal review places the works between 88 and 92. These are subjective working scores, not external certification, and they have not been rounded upward to meet the brief.

**Not performed / requires human confirmation:** a curator's exhibition-readiness judgment; continuous human viewing of the full animation on a calibrated display; optical comfort on actual displays; Safari / Firefox, physical phones, screen-reader interaction, 120/144 Hz hardware and long-duration memory profiling. No remote deployment or push was performed.

## Art-direction summary

| Work | Concept and distinguishing discovery | Color / type | Choreography and medium |
|---|---|---|---|
| 01 — Interval | Letters as architecture; the blank doorway becomes a cutting plane | Vermilion, ink, paper / Anton + Manrope | 16 s, five movements, staggered masked glyph entrances and rotated structural blocks / Canvas |
| 02 — The weight of a pause | Geometry transfers an implied weight; ring → separated scoops → standing balance | Sage, forest, butter, oxide / Bodoni + Manrope | 14 s, circle leads, cut follows, counterweight answers / Canvas |
| 03 — An herbarium of hours | A journal remembers an afternoon; two original botanical plates support three complete grids | Parchment, rust, olive / Bodoni Moda with true italic + Manrope | 18 s, Gather → Preserve → Remember, slow independent crop motion / DOM + SVG |
| 04 — Almost, aligned | The apparent image belongs to neither of its two geometric layers | Sulfur and dark olive / Anton + tracked Manrope | 20 s, actual linear, concentric and radial interference / Canvas |
| 05 — A tender disorder | Error becomes a shared current inside a remembered boundary | Slate, salmon, muted gray / light and heavy Manrope | 16 s, delayed wavefront, emergence and recovery / analytic vector field |
| 06 — Matter / after matter | Language becomes a porous surface, changing inside/outside relationships | Warm gray and charcoal / Anton as material, Manrope as label | 18 s, torus → helix → wave sheet / parametric 3D projected to Canvas |

Detailed concept, reference, visual, motion, technical, performance and limitation notes for every artwork are in [README](../README.md).

## Review method and evidence

1. **Static composition:** three distinct paused times per artwork, captured from the actual browser. The 18 frames were visually examined using the [contact sheet](contact-sheet.png), with individual full-size inspection for the letter choreography and sculpture. Six full-page mobile captures were examined through the [mobile sheet](mobile-sheet.png). The [catalogue](catalogue-desktop.png) and [Retina interference frame](04-retina.png) were also inspected.
2. **Motion choreography:** each work was actually run for slightly more than a full loop, while nine screenshots sampled the running player. The [live filmstrip](live-loop-filmstrip.png) was visually examined for progression, holds, intermediate arrangements and return. Timing measurements are stored in [playback.json](playback.json). This is sampled visual review of real playback, not a claim that a human watched every intervening frame.
3. **Originality:** each work was checked against its stated conceptual question and the other five works. The strongest distinct contribution is the moving herbarium; the most familiar territory is the geometric and field-based work. No novelty certification is claimed.
4. **Restraint:** no glow, bloom, gratuitous blur, decorative particles or live catalogue animations were added. A single quiet disk masks the optical singularity. The artwork information is outside the image.
5. **Technical quality:** control assertions, deterministic rendering, loop endpoint comparison, dimensions, runtime errors and measured frame cadence were checked separately from artistic evaluation.

## Iterations made after actual preview

| Observed issue | Change | Evidence |
|---|---|---|
| Scrubbing returned to the previous time | Capture the slider's requested value before updating playback UI | All six input controls tested with an exact 5 s assertion |
| Initial typographic header collided with giant type | Lower and bound the type; add individual masked entrances; move the first finished key composition to 4.2 s | 01 key frames and live filmstrip |
| Final type arrangement crowded the right-hand block on portrait | Increase separation, cap type size and reduce the final scale | Mobile preview and 01 final key composition |
| Ballet's final mass and contact line approached the footer | Reduce radius, rebalance its center and shorten vertical travel | 02 three key compositions |
| Editorial copy overlapped image/title at settled states | Move small images and text to distinct quiet regions in all three desktop grids | 03 three key compositions |
| Too many works shared the same serif internal title | Give 04 a compact optical headline, 05 a light/heavy grotesk contrast and 06 a neutral sculpture label | Final contact sheet |
| Field marks invaded title and footer | Add a smooth boundary envelope and clip the field's safe drawing region | 05 emergence composition |
| Sculpture was too small in portrait and text strips were too compressed | Increase silhouette size, widen the helix band and rebalance the wave surface | 06 portrait and three forms |
| Sculpture showed occasional missed frames in headless runs | Reduce tiles from 294 to 216, cache smaller glyph textures, reuse projected vertex arrays and hoist camera trigonometry | Final independent real-time cadence record; headless p95 varied between roughly 16.7 and 33.3 ms during refinement |
| Editorial/collection italic was synthesized | Bundle the original Bodoni Moda italic and load it before artwork rendering | Local font file, regenerated previews and final browser QA |

## Rubric scores

Scores are subjective internal assessments. The maximums are exactly the supplied weights. Artistic scores cannot be established by code assertions.

| Work | Art direction /25 | Composition /20 | Choreography /20 | Originality /15 | Color & type /10 | Technical /10 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01 — Interval | 23 | 18 | 18 | 13 | 9 | 9 | **90** |
| 02 — The weight of a pause | 22 | 18 | 18 | 12 | 9 | 9 | **88** |
| 03 — An herbarium of hours | 23 | 19 | 18 | 13 | 10 | 9 | **92** |
| 04 — Almost, aligned | 22 | 18 | 17 | 13 | 9 | 9 | **88** |
| 05 — A tender disorder | 22 | 18 | 18 | 12 | 9 | 10 | **89** |
| 06 — Matter / after matter | 23 | 18 | 17 | 13 | 9 | 8 | **88** |

### 01 — score rationale

- **Art direction 23:** the threshold is conceptually necessary and remains the organizing device.
- **Composition 18:** three distinct arrangements retain intentional negative space; the partly revealed entrance is intentionally more severe than the completed poster.
- **Choreography 18:** staggered glyph masks, crossing cuts, a rotated block and holds form a readable five-movement arc; the coda still retraces some spatial decisions.
- **Originality 13:** blank space behaves as an actor; splitting a word into architectural units remains a familiar kinetic-type strategy.
- **Color & type 9:** precise three-color contrast and bounded type scales; the Chinese micro label relies on system CJK glyphs rather than a bundled CJK family.
- **Technical 9:** deterministic playback, identical endpoint pixels and all controls pass; canvas glyphs themselves are not selectable text.

### 02 — score rationale

- **Art direction 22:** contact and implied weight are consistently expressed through four kinds of form.
- **Composition 18:** the revised radius protects the quiet title and lower information zone; the middle state remains deliberately sparse.
- **Choreography 18:** anticipation, the circle's arc, the propagated cut and the counterweight create a causal sequence; physical contact is stylized.
- **Originality 12:** the standing balance and borrowed void are specific discoveries, but the basic Concrete Art vocabulary is familiar.
- **Color & type 9:** restrained green/butter/oxide proportions and elegant title contrast; the small print is not intended for reading at thumbnail size.
- **Technical 9:** a low draw count, closed loop and controls pass; no independent cross-browser rendering comparison was performed.

### 03 — score rationale

- **Art direction 23:** the theme governs the prose, invented specimens, crop behavior and plate sequencing.
- **Composition 19:** all three finished spreads have a different focal image and clear hierarchy after the copy-placement revision.
- **Choreography 18:** frames, crops and title move at different scales and speeds; transitions briefly permit deliberate visual overlap.
- **Originality 13:** the journal actively reinterprets two specimens as three memories; botanical editorial imagery itself is established territory.
- **Color & type 10:** rust/olive imagery, parchment and genuine Bodoni italic form a coherent printed language with meaningful scale contrast.
- **Technical 9:** actual HTML text and alternate portrait layouts are robust in the tested browser; moving CSS geometry still incurs some layout work.

### 04 — score rationale

- **Art direction 22:** the image arises from an exact material premise, with a distinctive severe typographic voice.
- **Composition 18:** aperture, quiet margins and title are balanced; the centered field is deliberately more restrained than the other studies.
- **Choreography 17:** very small layer changes cause large perceived changes; motion is subtle and less narratively varied.
- **Originality 13:** three geometrically different phenomena read as one optical instrument; superposed-line interference is an established technique.
- **Color & type 9:** sulfur/olive and compact typography avoid a generic glowing digital aesthetic.
- **Technical 9:** bounded density, a protected radial center and DPR-2 screenshot review; actual display sampling and comfort remain device-dependent.

### 05 — score rationale

- **Art direction 22:** ordered boundaries support the idea of recoverable deviation rather than uncontrolled noise.
- **Composition 18:** the edge envelope preserves the title and makes the field feel contained; dense central marks still merge in thumbnails.
- **Choreography 18:** delayed onset, collective curl and recovery produce a clear progression with quiet endpoints.
- **Originality 12:** the fixed-boundary field has its own rhythm, but vector-field visualization is a familiar generative-art vocabulary.
- **Color & type 9:** a restrained salmon/slate ratio and contrasting type weights reinforce the system's two conditions.
- **Technical 10:** within this limited analytic-field design, deterministic seeks, fixed work per frame, closed endpoints and the measured target cadence are all satisfied. This score is not a claim of universal hardware certification.

### 06 — score rationale

- **Art direction 23:** the same typographic material consistently changes the meaning of enclosed, coiled and open space.
- **Composition 18:** a stronger silhouette and quieter label improve the camera view; some oblique letters still compress.
- **Choreography 17:** topology correspondence gives continuous transformations; the interpolated in-between surfaces are less resolved than the three held structures.
- **Originality 13:** language forms a porous skin rather than extruded text; the torus/helix family remains a known spatial motif.
- **Color & type 9:** charcoal on warm gray makes the form carry the work; depth shading sometimes reduces the back letters' clarity.
- **Technical 8:** the optimized target cadence and control tests pass, but affine surface patches and painter-order depth sorting are approximations that can show grazing-angle or self-intersection artifacts.

## Actual verification

| Check | Result / scope |
|---|---|
| `npm run build` | Passed: static JS syntax and HTML local-reference checks; no compilation is needed |
| `npm run lint` | Passed: same explicit syntax/reference validator; this is not an ESLint or TypeScript claim |
| Type check | Not applicable: this project uses plain ES modules and has no TypeScript configuration |
| `node scripts/qa.cjs` | Passed all six works in installed Chromium headless shell; machine-readable details in `verification.json` |
| Artwork routes | All six returned HTTP 200; collection and six preview images loaded |
| Play / pause / reset / scrub | Asserted for every work, including exact seek time |
| Loop / once | Asserted wrap while playing, and stop at duration with looping disabled |
| Keyboard | Home, Right and Space exercised; native controls retain focus behavior |
| Fullscreen | Entered and exited for every work in the tested browser |
| Determinism | A → B → A rendering compared exactly for every work |
| Endpoint seam | Pixel comparison at 0 and duration; mean channel delta recorded in `verification.json` |
| Reduced motion | All six opened paused at their representative time; explicit Play worked |
| Mobile / tablet | 390×844 and 820×1180; no horizontal page overflow |
| Narrow landscape | 844×390; all six checked for horizontal overflow |
| Retina sampling | 820×1180 at DPR 2, optical work screenshot visually inspected |
| Browser errors | No captured runtime errors or HTTP 4xx/5xx during the successful suite |
| Complete playback | All six ran beyond one full real-time loop; nine actual running frames each |
| Frame cadence | Separate 180-frame runs, without screenshots; final values in `playback.json` |
| Visual inspection | 18 key compositions, six mobile pages, catalogue, Retina optical frame, sampled full-loop filmstrip |
| `git diff --check` | Checked before final commit; no whitespace errors |

The synchronous 120-seek stress timings in `verification.json` include queued Canvas rendering effects and should **not** be interpreted as playback frame intervals. `playback.json` is the appropriate source for observed animation cadence. The final runs on this host were approximately 16.7 ms at the median; see the JSON for p95 and outliers rather than assuming a universal 60 fps guarantee.

No exhaustive heap/leak audit, automated accessibility audit or assistive-technology session was run. Lifecycle code was inspected; background-tab suspension was not independently asserted by the browser suite. No external art jury reviewed the work.

## Reproduction

From `motion-graphics-astra/`, run `npm run dev`, then `npm run build`, `npm run lint`, `node scripts/qa.cjs` and `node scripts/playback-qa.cjs`. QA uses the locally installed browser/runtime paths, which can be overridden with `CHROMIUM_PATH` and `NODE_MODULES`. See the parent README for details. The tests intentionally do not modify any directory outside this new project.
