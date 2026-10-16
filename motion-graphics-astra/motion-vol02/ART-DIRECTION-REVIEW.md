# Vol. 02 — Art direction and verification

Review date: 2026-10-16. Scope: Astra implementation only. The six positions in each row of [contact-sheet.png](review/contact-sheet.png) are 0%, 20%, 40%, 60%, 80%, 100%. The [live filmstrip](review/live-filmstrip.png) was sampled during actual timed playback, including a return into the next loop. Images were visually inspected, including the mobile sheet and white-material study. This is a frame-sequence review, not a human uninterrupted video viewing or independent jury assessment.

## Internal rubric

| Work | Art direction /25 | Composition /20 | Motion /20 | Originality /15 | Material /10 | Technical /10 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| 07 Nothing keeps its edges | 23 | 18 | 18 | 12 | 9 | 8 | 88 |
| 08 Held, then released | 23 | 19 | 18 | 12 | 9 | 9 | 90 |
| 09 A letter to the wind | 23 | 18 | 18 | 12 | 8 | 9 | 88 |
| 10 The angle of a colour | 23 | 19 | 18 | 13 | 9 | 9 | 91 |
| 11 Light edits the page | 23 | 18 | 17 | 13 | 9 | 9 | 89 |
| 12 The shape of an afterimage | 23 | 18 | 18 | 13 | 9 | 9 | 90 |

The 90+ ambition is not claimed for every work. These scores locate remaining weaknesses; they do not certify exhibition readiness.

## 07 — Nothing keeps its edges

**Composition:** the broad word and small two-line voice provide three scales. The 12.8 s staggered two-line word changes the reading structure, rather than merely distorting the opening. **Motion:** a held word precedes local softening, union and reconstitution. **Material:** the union now joins actual glyph feet; the initial implementation left disconnected ornamental curls. **Originality:** reading changes with material state, but melting type itself is familiar. **Restraint:** no highlights, drips or simulated chrome.

**Actual revisions:** rebuilt bridge anchors to overlap the letters; ended the bridges before the layout shift; reduced mask slice size from 3 px to 1 px; changed the density filter from 25 to 9 samples and capped its output at 800 px. **Remaining weakness:** the 9.6 s transition is less clear than either stable layout, and close enlargement reveals softness. A demanding director could request a more distinctive final word architecture. Technical deduction reflects software-GPU cost, not a failed playback control.

## 08 — Held, then released

**Composition:** custom round PULL sits below a calm serif phrase; a single pale marker identifies the force. **Motion:** an impulse enters different stroke regions at different times, with visibly different local recovery. **Material:** no whole-glyph spring transform is used. **Originality:** the memory is in the letter skeleton; spring typography remains an established vocabulary. **Restraint:** three fine echoes are enough; no particle or glow layer was added.

**Review outcome:** the 2.8 s deformation and 5.6 s recoil retain continuous strokes and legibility. Kept the long recovery pause after checking the live sequence; no gratuitous second impulse was added. **Remaining weakness:** the final 20% changes very little. This is intentional rest but may feel long to viewers expecting constant activity. Not all intermediate letter proportions have the polish of a finished typeface.

## 09 — A letter to the wind

**Composition:** an intimate printed sheet occupies a terracotta field. Cream fronts and ochre backs communicate material orientation without explanatory diagrams. **Motion:** alternating accordion folds precede cross-folds; the printed sentence changes through concealment. **Material:** thin planes, visible reverses and fold shading avoid a thick-card appearance. **Originality:** original prose belongs to the folds, though the hinged panel vocabulary is recognizable.

**Actual revisions:** enlarged the sheet within the available height; reversed the lower fold direction and increased its angle so versos come toward the viewer rather than disappearing behind the top row; increased the right-hand reveal; reduced long-word heading sizes and enabled wrapping to stop clipped “remembers” and “unchanged.” **Remaining weakness:** the 12 s silhouette is deliberately fragmented and has less visual weight than the flat sheet. Rigid planes cannot reproduce the softness of real paper, and some faces naturally occlude others. These limitations account for the material and composition deductions.

## 10 — The angle of a colour

**Composition:** an offset, open band holds its identity in both optical and white-material images. **Motion:** light changes precede fuller chromatic modulation; the camera avoids endless demonstrative spinning. **Material:** wavelength phase, thickness, normals and grazing angle jointly determine colour. **Originality:** the clear central counterform matters more than surface novelty. **Restraint:** muted film colour, no glow or environment map.

**Review outcome:** inspected the separate white study and retained the geometry; a large neutral center and open edge remained legible. Limited rendering resolution in the shared renderer while preserving aspect ratio. **Remaining weakness:** this is one sculptural family rather than radically different silhouettes. Fine mesh shading and three-band spectral approximation remain visible to technical scrutiny; neutral materials do not constitute physical validation.

## 11 — Light edits the page

**Composition:** oxide block, deep-green type and a rule field establish a printed page before the slab arrives. **Motion:** the slab enters, crosses the type, rests across the empty region, and departs. **Material:** actual background letters and rules are displaced; the highlight is not standing in for refraction. **Originality:** an optical object acts as an editor. **Restraint:** low dispersion avoids decorative rainbow edges.

**Review outcome:** inspected the type at 3.2 s and the rule field at 9.6 s; the slab preserves readable external context and distorted internal strokes. Retained a subtle boundary rather than increasing glow for visibility. **Remaining weakness:** 6.4–12.8 s are compositionally similar, and the pale boundary is understated on a small screen. A stricter director might require a second, more surprising relationship between the slab and the word.

## 12 — The shape of an afterimage

**Composition:** AFTER balances a copper temporal volume with a large dark interval between them. **Motion:** one present arc precedes continuous history, discrete cuts and layered exposure, then releases all three. **Material:** history is reconstructed from time, not accumulated unpredictably. **Originality:** several ways of retaining one gesture coexist without becoming a generic mouse trail. **Restraint:** no particles, glow or colour ramp.

**Actual revisions:** increased continuous trail opacity and stroke width after the 8 s review looked too faint; retained sparse opening and ending frames. **Remaining weakness:** the arc silhouette is familiar in generative graphics. The opening is quieter than the climax and needs a dark viewing environment to reveal all fine traces.

## Cross-artwork distinction

07 is heavy brown continuous ink; 08 is soft rose tensile line; 09 is terracotta folded editorial matter; 10 is a pale optical sculpture; 11 is flat green/oxide print through glass; 12 is dark temporal drawing. Rendering follows the concept: density shader, vector paths, CSS 3D, mesh shader, texture refraction and analytic Canvas history. Rhythm ranges from damped impulse through hinged stages to slow optical contemplation. Shared peripheral captions supply the series identity without making the six images identical.

## Executed verification

- Chromium 141 headless browser, desktop 1440×1100, mobile viewport 390×844, tablet viewport 820×1180.
- All six routes returned HTTP 200; all six catalogue previews decoded; local collection and next-work links checked by the static validator.
- Six timeline screenshots per work, full-loop wall-clock playback with seven sampled frames per work, mobile screenshots and a separate white-material image.
- Play/Pause, Reset, scrub, loop enabled/disabled, Home/Right/Space keyboard behavior and fullscreen entry/exit.
- Repeated direct seek to 3.25 s produced identical canvas/DOM representations after an intervening seek. This verifies deterministic composition, not only identical time labels.
- Start/end screenshot mean channel difference below 0.15/255 for every work; exact numeric results retained in JSON.
- Reduced-motion startup paused at the declared still for all six works; explicit Play worked.
- No captured page errors or HTTP errors; no document horizontal overflow in mobile/tablet tests.
- 90 requestAnimationFrame interval samples per work. In the full-loop run: liquid median ≈33.3 ms, p95 ≈33.4 ms; the other five median ≈16.7 ms, p95 16.8–33.4 ms. These are renderer cadence observations from this machine, not a promise for other hardware.
- Final static recheck refreshes screenshots after paper text fitting; the live filmstrip predates only that font-size adjustment. Rendering and fold choreography are unchanged.
- Build and lint commands use the repository’s static syntax/local-reference checker. No TypeScript target exists in Astra.

**Not tested:** Safari, Firefox, physical mobile devices, hardware GPU profiling, screen reader listening, medical photosensitivity certification, long-duration memory profiling, WebGL context recovery and audio (this volume has none). Performance instrumentation is not a memory-leak proof. Page teardown deletes owned rendering resources, but GPU context loss requires a reload.

**Completion:** six artworks, independent pages, controls, catalogue, docs and review evidence complete. Independent artistic approval remains human judgment; three works retain an internal score below the 90-point ambition.
