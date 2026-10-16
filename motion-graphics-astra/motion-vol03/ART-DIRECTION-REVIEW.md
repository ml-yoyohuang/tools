# Vol. 03 — Critical review and delivery record

2026-10-16. Review scope: the Astra collection, works 13–18. Art direction was recorded in [ART-DIRECTION-BRIEFS.md](ART-DIRECTION-BRIEFS.md) before renderer implementation. Browser review used six positions per work: 0%, 20%, 40%, 60%, 80%, 100%, plus actual timed playback sampled across a complete loop and into the following cycle.

Evidence: [contact sheet](review/contact-sheet.png), [mobile sheet](review/mobile-sheet.png), [live filmstrip](review/live-filmstrip.png), individual numbered PNGs, [final browser results](review/live-verification.json), [cross-volume regression](review/integration.json). Images were visually inspected. The motion assessment is based on real-time playback samples and their sequence; it is not a claim of uninterrupted human video viewing. Audio was instrumentally checked, not listened to by a human reviewer.

## Internal rubric

| Work | Art direction /25 | Composition /20 | Motion /20 | Originality /15 | Colour & type /10 | Technical /10 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| 13 Please remain in the picture | 23 | 18 | 18 | 13 | 9 | 9 | 90 |
| 14 An address that cannot exist | 22 | 18 | 17 | 11 | 9 | 9 | 86 |
| 15 Two inks, a third voice | 23 | 18 | 18 | 12 | 10 | 9 | 90 |
| 16 Rooms for a small ensemble | 23 | 18 | 17 | 13 | 9 | 9 | 89 |
| 17 The colour between us | 23 | 19 | 18 | 12 | 10 | 9 | 91 |
| 18 The guest is the gap | 23 | 19 | 18 | 11 | 9 | 9 | 89 |

These are self-critical estimates, not a quality certificate. Three works remain below the 90-point ambition. The most significant remaining issues are the familiarity of the perceptual mechanisms in 14/18 and the restrained compositional range of 16. They are not concealed by raising the scores.

## 13 — Please remain in the picture

1. **What is beautiful?** The heavy olive-black word blocks and the small human request give the transmission emotional scale. The gap between WITH and ME carries real compositional weight. The 9.6 s collapsed word makes a second horizontal image without adding another symbol.
2. **What is still generic?** Horizontal sync deformation belongs to a familiar analog-video vocabulary. The original contribution is its role in this specific sentence, not an invented distortion algorithm.
3. **What is unnecessary?** Dense noise, RGB tearing and lens glare would dilute the sentence. They were excluded. A single low-opacity scan structure remains subordinate to the type.
4. **Weakest key frame?** 12.8 s, when the word is almost restored but the gold memory has not fully vanished. It is a quieter transitional print rather than the strongest standalone poster.
5. **Weakest transition?** Recovery from compression into a full-height WITH. A raster remap can reveal its mechanism during the intermediate heights.
6. **What is memorable?** The request to remain in the picture continues to make sense as the picture fails to remain stable.
7. **What might a demanding director reject?** Any hint of arbitrary horizontal fragments or a generic cyberpunk read. The initial plate compression produced stray fragments above ME and was rejected in review.
8. **Actual changes.** Separated WITH into its own cached plate; removed unintended ME compression; expanded the entire glyph’s compressed range so no top strokes remain detached; moved the first two baselines away from the peripheral caption; changed the black duplicate into a restrained gold memory.

## 14 — An address that cannot exist

1. **What is beautiful?** Ivory faces and green side planes make a light, exact construction. The word Elsewhere balances the object without pretending to be a technical coordinate system.
2. **What is still generic?** The reversible room, impossible depth cycle and three-prong/two-support paradox are established perceptual devices. They are acknowledged precedents; originality is therefore scored lower.
3. **What is unnecessary?** An orbiting camera, environment reflections and decorative measurements would turn the work into a model demonstration. None were added.
4. **Weakest key frame?** 9.6 s, during the curtain between the triangular depth cycle and the prongs. The hybrid silhouette is less resolved than the held constructions.
5. **Weakest transition?** Triangle to prongs: a spatial wipe communicates replacement well but provides less conceptual continuity than a true all-vertex morph would.
6. **What is memorable?** Local over/under joins impose A>B>C>A, followed by the impossible task of counting three front ends and two rear supports.
7. **What might a demanding director reject?** Familiar puzzle content or a visible clipping artifact. The first triangular join showed circular mask seams; a second attempt created false end caps. Both were rejected.
8. **Actual changes.** Replaced circular mask patches, then removed the replacement end-cap artifacts. The final join overrides only the one face necessary to establish the cyclic depth relation; it does not repaint a capped short prism. The low object count and uninterrupted held states were retained.

## 15 — Two inks, a third voice

1. **What is beautiful?** Rose and petrol blue produce a deep shared region while their separate screens remain visible. The changing density produces tactile depth without fake paper grain.
2. **What is still generic?** Two overlapping discs are a familiar formal starting point. The distinct print structures and controlled plate movement supply the development.
3. **What is unnecessary?** Random roughness, registration crosses and distressed type would imitate print superficially. They were excluded. The print window’s crop is intentional.
4. **Weakest key frame?** 10.8 s, when line-screen and open-lattice weights overlap. Its texture is less immediately legible than either complete screen.
5. **Weakest transition?** Line screen to lattice: the interval is tonally softer because two structures temporarily share the same coverage budget.
6. **What is memorable?** The darkest colour belongs to no separate plate; the overlap is a third voice created by the first two.
7. **What might a demanding director reject?** Three screens that only change the size or outline of the same dots. The initial filled diamonds were too close to the circular dot screen.
8. **Actual changes.** Replaced filled diamonds with a connected, hollow lattice whose stroke density varies continuously. This makes the third phase structurally distinct from disks and continuous parallel strokes. Retained a generous 14-unit pitch to restrain shimmer.

## 16 — Rooms for a small ensemble

1. **What is beautiful?** Parchment arches and brass accents form a warm room against a deep teal field. The final rest leaves the architecture present but quiet.
2. **What is still generic?** Repeated arches can read as a familiar colonnade. The compositional envelope is deliberately narrow; the motion score changes occupancy more than overall silhouette.
3. **What is unnecessary?** Frequency bars, waveform overlays and beat particles would compete with the musical structure. No such layer was added. The title describes the ensemble rather than reporting fake audio metrics.
4. **Weakest key frame?** 0 s, when the stage is dormant and its fine arches have low contrast. It is a designed anticipation but less visually rich than the active phrase.
5. **Weakest transition?** The second melodic phrase reuses the same seven arches. A future revision could compose a more surprising spatial answer while preserving the score.
6. **What is memorable?** Rhythm lays the floor, melody opens the arcade and harmony changes the planes behind it. Each audible event has an actual corresponding score event in the image.
7. **What might a demanding director reject?** A music-reactive appearance without real musical structure, or a spectrum disguised as buildings. The score is original and explicit; no FFT or amplitude data drives the composition. Still, greater phrase-level spatial contrast would strengthen it.
8. **Actual changes.** Increased the portrait arcade height and adjusted its floor position to improve scale. Made the AudioContext clock the active visual clock when sound is enabled; added measured waveform and synchronization checks; removed duplicate audio cleanup so only the shared owner disposes the context.

## 17 — The colour between us

1. **What is beautiful?** Russet and straw have unequal visual weight, and the constant peach swatches quietly expose the role of adjacency. The late mineral field gives the straw gap an architectural reading.
2. **What is still generic?** Equal swatches on unequal grounds are a classic colour-study device. The shared band and architectural boundary sequence develop the familiar starting point.
3. **What is unnecessary?** Gradients, blur and explanatory arrows would weaken the hard-edge relationships. They were excluded. The peripheral caption stays small.
4. **Weakest key frame?** 3.2 s, early in territory redistribution: the change is subtle and may not immediately reward a brief glance.
5. **Weakest transition?** The swatches meeting while the arch begins to open. The band briefly interrupts the arch silhouette, trading shape clarity for the colour-equality reveal.
6. **What is memorable?** Two apparently different colours meet without a seam. Later the unpainted interval between masses becomes a room.
7. **What might a demanding director reject?** An arch claimed in the text but not actually legible in the image. The first boundary construction produced an uncertain bump rather than a coherent negative arch.
8. **Actual changes.** Rebuilt the two masses as complementary cubic boundaries sharing a crown. The straw opening is now a direct consequence of the solid boundaries. Exact peach RGB remains unchanged through every state; no colour tween fabricates the perception effect.

## 18 — The guest is the gap

1. **What is beautiful?** Two severe masses leave a finely articulated vessel between them. The same contour carries two competing readings with only two inks.
2. **What is still generic?** Vase/profile figure-ground reversal is well known. This limits the originality score despite the care of the sequence.
3. **What is unnecessary?** Texture, shadows or a third accent colour would weaken the shared boundary. None were added.
4. **Weakest key frame?** 2.8 s, when the narrow interval has begun to articulate but has not yet fully become the vessel. It requires time to read.
5. **Weakest transition?** The spatial inversion wipe. At intermediate positions the two visual polarities coexist, making the overall silhouette intentionally unstable.
6. **What is memorable?** The absence acquires dark weight without a new object entering, then a simple occluding lintel makes that same absence into a doorway.
7. **What might a demanding director reject?** A static Rubin-vase reference with merely cosmetic motion. The additional door transformation and timed occlusion are essential to the piece.
8. **Actual changes.** Extended the held inverse state through the door phase so the doorway reads as a complete image before polarity returns. This removed the premature partial wipe from the 80% composition.

## Cross-artwork review

| Work | Dominant experience | Composition | Rhythm | Colour / surface |
|---|---|---|---|---|
| 13 | Archival, vulnerable language | Three unequal typographic blocks | Slow drift → compression → recovery | Bone, olive ink, gold memory |
| 14 | Intellectual depth contradiction | Offset constructed object / serif anchor | Held forms separated by spatial curtains | Mineral green, ivory prism faces |
| 15 | Tactile overprint | Two cropped planetary screens | Screen changes and registration counterpoint | Rose / petrol multiplication on warm paper |
| 16 | Musical construction | Floor, arcade, sustained rear planes | Actual score onsets, counterpoint, rest | Midnight teal / parchment / brass / clay |
| 17 | Luminous relational colour | Large unequal fields and shared boundaries | Deliberate area redistribution | Flat russet, straw, mineral, constant peach |
| 18 | Silent absence | Paired masses and an active central gap | Reveal → hold → spatial inversion | Two-tone bone and charcoal |

13 and 15 are both raster/print-adjacent but differ in composition, palette, image scale and temporal strategy. 14 and 18 share perceptual ambiguity, yet 14 uses explicit depth faces while 18 removes depth and assigns agency to the ground. 16 is the only dark musical environment. 17 reduces type to let colour area dominate. The common viewer UI is outside the artboards; it is not an imposed visual motif inside the six works.

## Verification record

- Browser: Chromium 141.0.7390.37 headless, using real Canvas and Web Audio APIs.
- Six routes returned HTTP 200. Six catalogue preview images decoded. All local HTML links passed the static checker; the integration runner also requested actual catalogue and next-work links.
- Six key positions per work captured at desktop viewport 1440×1100. Mobile 390×844 and tablet 820×1180 tested without horizontal document overflow. Mobile screenshots visually reviewed.
- All Play/Pause, Reset, timeline, Loop off stop, Loop on wrap, Home/Right/Space keyboard behavior and fullscreen entry/exit checks passed.
- Repeated direct seek after an intervening seek produced identical canvas output. Endpoint screenshot mean channel difference remained below 0.15/255 for each work, with numeric values in JSON.
- Reduced-motion startup stayed paused at each declared still and explicit Play worked. Cross-volume tests also exercised a live preference change.
- Each work played through a full real-time loop and into the following cycle; seven timed samples are retained in the filmstrip and JSON. Final cadence tests sampled 90 rAF intervals per work; observed medians were approximately 16.7 ms, with p95 around 16.7–33.4 ms in the final run. Final machine readings, including any scheduling variation, are in live-verification.json. After inspecting the catalogue, the representative stills for 15, 17 and 18 were moved to their completed lattice, arch and inverse-vessel compositions; the final static verification refreshes those previews without changing any timeline choreography.
- Audio: no AudioContext before opt-in; sound enabled by button; scheduled events present; actual non-zero waveform peak below 1.0; visual time within 0.12 s of AudioContext clock; scrubbing paused playback and cleared active/future nodes; resume rebuilt sound; mute worked. One sampled peak was approximately 0.035. These are measured graph behaviors, not listening approval.
- All 18 works across Vol. 01/02/03 passed loop stop/resume, route/next-link and live reduced-motion regression after the shared audio-clock extension. All three catalogue navs expose all three volumes.
- No captured runtime page errors or HTTP errors in final volume QA. Build and lint run the existing syntax/reference validator; there is no TypeScript target in this static project.

**Failed checks and corrections:** integration first found only two volume links in the Vol. 02 catalogue. The generator condition was removed, the pages regenerated and the 18-work regression rerun successfully. Early visual masks and signal fragments were corrected as described above; code execution alone was never treated as visual acceptance.

**Not verified:** Safari/Firefox, physical phones/tablets, hardware display calibration, long-running memory profiling, screen-reader listening, human music listening, speaker latency and independent curatorial assessment. Browser viewport emulation is not physical-device testing. Endpoint equality does not prove that every perceptual transition is equally strong.

## Completion status

- **Complete:** six independent artworks and routes, full controls, catalogue, local assets, original score, opt-in audio, art briefs, six-position images, real-time loop evidence, responsive checks, refinements, documentation and regression coverage.
- **Partially achieved artistic ambition:** the internal 90+ goal is not claimed for works 14, 16 and 18. Their concrete remaining weaknesses are recorded above.
- **Human confirmation:** independent aesthetic judgment, musical listening and target-device acceptance remain outside the automated verification.
- **Delivery:** committed and pushed separately after Vol. 02, on the feature branch requested by the user; no production deployment or main-branch push is implied.
