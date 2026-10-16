# MOTION STUDIES — VOL. 02

## The Materiality of Motion

Six independent posters, numbered 07–12. [Collection](index.html) · [Pre-implementation briefs](ART-DIRECTION-BRIEFS.md) · [Critical review](ART-DIRECTION-REVIEW.md) · [36 key frames](review/contact-sheet.png) · [Mobile review](review/mobile-sheet.png) · [Full-loop sampling](review/live-filmstrip.png).

Run “npm run dev” in “motion-graphics-astra”; open “http://127.0.0.1:4178/motion-vol02/”. No bundler or runtime packages are required. Local ES modules require HTTP.

## Shared presentation and engineering

Play / Pause, Reset, timeline, loop and fullscreen are available on every page. Keyboard: Space/K, R, L, arrows, Shift+arrows, Home/End, F. Focused native controls retain their native keys. Fullscreen is artwork-only; Escape returns to the page. HTML descriptions, accessible names, visible focus and a polite playback announcement accompany the canvas. Reduced-motion users begin with a representative paused composition and can explicitly play.

Every frame is a function of absolute time; the first and last frame match. Tab hiding cancels requestAnimationFrame without advancing hidden time. Page exit disposes GPU buffers, textures, programs and DOM artwork. ResizeObserver redraws only when dimensions change. Canvas rendering is capped at 1.7 physical pixels per logical unit, WebGL at a 1100 px long edge, and liquid at 800 px.

Landscape and portrait use a dynamic logical height. Typography remains within a 1000-unit width, but vertical placement, figure height and whitespace change with aspect ratio. Paper preserves a readable fixed-ratio sheet inside the adaptive stage. Controls wrap below the image. The catalogue uses static previews, so six renderers never compete in the background.

Fonts: locally hosted Anton, Bodoni Moda and Manrope from Vol. 01, with their SIL Open Font Licenses in “../motion-vol01/assets/fonts/”. All text, geometry, shader code and images are generated locally; no stock assets, external runtime CDN or analytics.

Shader compile/link failures are caught and reported. A working WebGL browser is required for 07, 10 and 11; a GPU-less browser receives a clear notice. Catalogue previews remain available as static alternatives.

## 07 — Nothing keeps its edges

[Open artwork](07-liquid-typography/index.html)

**Concept / rationale.** Language softens at its boundaries. Separate letters briefly become one continuous body, then settle into a different reading. 字形各自軟化、向下延展，接觸處形成液橋。閱讀秩序從一行變成兩層，再回到最初的邊界。

**Artistic references.** Wet letterpress and experimental concrete poetry; process rather than an artist’s signature image.

**Visual system / typography.** Anton supplies mass; Bodoni supplies a soft spoken countervoice. A broad word becomes joined matter, then a staggered two-line reading. Palette: #ede6d6, #40372b, #a74d32.

**Composition and motion.** MELT is the main image. Warm mineral paper and dark brown ink recall wet letterpress rather than chrome. Opening: a stable broad word. Transformation: individually stretched glyph feet merge through thresholded density. Climax: ME / LT becomes a staggered two-line body. Emotion: sensual but heavy. Local scanline deformation and smooth density union are chosen to make contours, rather than an entire screenshot, change. Timeline: 0s I / Legibility → 2s II / Softening → 5s III / Dissolution → 9s IV / Reconstitution → 13s V / Resolution; loop closes at 16s.

**Technical approach.** Four cached glyph masks are sliced locally. A nine-tap density filter closes their boundaries. Deliberately drawn bridges merge the individual bodies. This is an art-directed material model, not a fluid solver. Dependencies: browser-native APIs and shared local modules only.

**Performance.** The GPU surface is limited to an 800 px long edge; the CPU mask remains 1000 logical pixels wide. Software rendering is the limiting workload.

**Accessibility / responsive.** Shared controls and reduced-motion still at 7.6s. Logical artboard adapts to portrait height; narrative descriptions remain outside the image.

**Known limitations.** Some enlargement softness remains. The transformation suggests heavy ink rather than a physically conserved liquid.

**Review.** Six positions: 0, 3.2, 6.4, 9.6, 12.8, 16s. See the itemized critical review and saved PNGs in “review/”.

## 08 — Held, then released

[Open artwork](08-elastic-letterforms/index.html)

**Concept / rationale.** A word can store a gesture. A local pull travels through four connected letter bodies, and each region remembers it for a different length of time. PULL 的字體骨架承受一股局部力量。不同區域以不同頻率延遲回彈，讓張力在字母內部傳遞。

**Artistic references.** Tensile structures, monoline lettering and restrained kinetic typography.

**Visual system / typography.** Custom P/U/L/L paths, mulberry strokes, dusty pink ground and one pale force point. The baseline is deliberately low. Palette: #dfc4cc, #542c42, #efe092.

**Composition and motion.** Custom monoline PULL letterforms have generous round internal spaces. Mulberry on dusty rose is punctuated by one pale force marker. Opening: low, wide word at rest. Transformation: a local tensile crest, not whole-letter bouncing. Climax: different stroke sections move out of phase while the word remains continuous. Emotion: poised energy. Cubic path control points follow analytically damped spatial modes. Timeline: 0s I / Equilibrium → 2s II / Force → 4s III / Propagation → 6s IV / Oscillation → 10s V / Recovery; loop closes at 14s.

**Technical approach.** Continuous cubic path control points follow spatially varying, damped analytic modes. The four glyphs receive the impulse at staggered times. Dependencies: browser-native APIs and shared local modules only.

**Performance.** Four paths and three fine echoes; no physics integration or per-frame DOM layout.

**Accessibility / responsive.** Shared controls and reduced-motion still at 5.6s. Logical artboard adapts to portrait height; narrative descriptions remain outside the image.

**Known limitations.** A stylized elastic skeleton, not a filled font mesh or finite-element simulation.

**Review.** Six positions: 0, 2.8, 5.6, 8.4, 11.2, 14s. See the itemized critical review and saved PNGs in “review/”.

## 09 — A letter to the wind

[Open artwork](09-paper-engineering/index.html)

**Concept / rationale.** An unsent letter has two readings: what the front declares, and what its folds keep out of sight. 六個紙面由同一張海報展開。手風琴摺與橫向摺改變閱讀順序，背面揭露「Nothing arrives unchanged」。

**Artistic references.** Folded artists’ books and the plane-to-space inquiry of Lygia Clark. See the research links below.

**Visual system / typography.** Bodoni headings, small Manrope prose, cream fronts and ochre versos against terracotta. An original unsent letter supplies every printed word. Palette: #a95e43, #eee8d5, #dbb25f.

**Composition and motion.** An invented unsent letter, with topographic ellipses as wind contours, spans six thin cream pages. Ochre backs carry the concealed sentence. Opening: flat 3×2 poster. Transformation: alternating vertical folds make a small architecture. Climax: horizontal lower leaves turn over while a side leaf reveals its back. Emotion: intimate and intellectual. Actual CSS 3D faces, finite thickness and restrained light-dependent shades preserve text and paper structure. Timeline: 0s I / Flatness → 3s II / First fold → 7s III / Expansion → 11s IV / Revelation → 16s V / Unfolding; loop closes at 20s.

**Technical approach.** Six CSS 3D panels with front/back faces. Alternating vertical hinges precede horizontal lower folds and a right-hand verso reveal. Shading responds to fold angle. Dependencies: browser-native APIs and shared local modules only.

**Performance.** Six transformed planes; fixed-size printed faces. Only the world scale and placement adapt to available space.

**Accessibility / responsive.** Shared controls and reduced-motion still at 9s. Logical artboard adapts to portrait height; narrative descriptions remain outside the image.

**Known limitations.** Rigid hinged panels approximate paper. No continuous curl, self-collision solver, cast-light renderer or physically simulated thickness. Some text is intentionally concealed during folds.

**Review.** Six positions: 0, 4, 8, 12, 16, 20s. See the itemized critical review and saved PNGs in “review/”.

## 10 — The angle of a colour

[Open artwork](10-iridescent-sculpture/index.html)

**Concept / rationale.** Colour is an event between a surface and a viewer. A narrow twisted film makes that event visible without becoming a rainbow ornament. 一條連續扭轉的薄帶。法線、視角與膜厚共同控制色彩；光線先變，曲面再回應。可切換白色材質檢視輪廓。

**Artistic references.** Minimal sculpture and thin-film interference; no texture image or copied sculpture.

**Visual system / typography.** One open twisted band, silver/olive body and localized warm/cool edge colour. Bodoni caption occupies the lower left, outside the silhouette. Palette: #e8e8df, #9aa78f, #b39b77.

**Composition and motion.** A single twisted band with a clear open center. Pale neutral surround and mostly silver/olive film; chroma concentrates at oblique edges. Opening: quiet vertical-leaning loop. Transformation: light angle changes before the band flexes. Climax: thin-film wavelength differences expose warm and cool regions. Emotion: contemplative luminosity. A true triangle mesh, computed normals, Fresnel response and three-wavelength interference keep colour tied to geometry. White-material view is a required silhouette test. Timeline: 0s I / Still object → 3s II / Light shift → 6s III / Surface motion → 10s IV / Chromatic climax → 14s V / Quiet resolution; loop closes at 18s.

**Technical approach.** An indexed-style triangle list samples a parametric strip; numerical derivatives provide normals. View direction, refracted angle, film thickness, three wavelengths and Fresnel weighting drive colour. White study isolates the geometry. Dependencies: browser-native APIs and shared local modules only.

**Performance.** 120 × 18 surface cells, depth test, cached uniforms; long-edge GPU cap of 1100 px. Mesh and shader resources are deleted on page exit.

**Accessibility / responsive.** Shared controls and reduced-motion still at 9s. Logical artboard adapts to portrait height; narrative descriptions remain outside the image.

**Known limitations.** Three selected wavelengths are an artistic spectral approximation. RGB conversion, coating absorption, multiple internal bounces and polarization are omitted. This is not a physically calibrated renderer.

**Review.** Six positions: 0, 3.6, 7.2, 10.8, 14.4, 18s. See the itemized critical review and saved PNGs in “review/”.

## 11 — Light edits the page

[Open artwork](11-light-through-glass/index.html)

**Concept / rationale.** A transparent surface becomes an editor: it displaces a word, redraws a boundary and leaves the page intact. 玻璃片通過大型文字與色域，讓相同背景在邊界內外形成兩種讀法。折射、細微色散與邊緣反射共用同一個曲面模型。

**Artistic references.** Optical still life, typographic printmaking and the reflection/transmission model in pbrt.

**Visual system / typography.** Forest green LIGHT and rules, a flat oxide rectangle and pale mineral paper. Transparent negative space remains a major part of the picture. Palette: #e8eadf, #284e47, #b96d42.

**Composition and motion.** A large word LIGHT, an oxide rectangle and a tightly spaced green rule field supply information for a single glass slab to rearrange. Opening: clean asymmetrical print. Transformation: magnified and displaced letter strokes inside the slab. Climax: the slab bridges the word and the empty field. Emotion: quiet photographic ambiguity. Screen-space refraction uses the same lens-normal field for displacement, tiny spectral separation and edge highlights. Timeline: 0s I / Clear composition → 2s II / Interference → 5s III / Refraction → 9s IV / Light composition → 13s V / Departure; loop closes at 16s.

**Technical approach.** A cached printed scene is sampled through a rotating rounded slab. One local normal field controls displacement, edge response and subtle RGB separation. Dependencies: browser-native APIs and shared local modules only.

**Performance.** The background texture uploads only on resize. The fragment shader uses a small fixed number of texture reads.

**Accessibility / responsive.** Shared controls and reduced-motion still at 8.5s. Logical artboard adapts to portrait height; narrative descriptions remain outside the image.

**Known limitations.** Screen-space lens approximation, not volumetric ray tracing. No caustic projection, multiple bounce reflection or real-world refractive calibration.

**Review.** Six positions: 0, 3.2, 6.4, 9.6, 12.8, 16s. See the itemized critical review and saved PNGs in “review/”.

## 12 — The shape of an afterimage

[Open artwork](12-time-as-material/index.html)

**Concept / rationale.** A single gesture is small. Its past, held beside its present, becomes a room. 同一個弧形姿態同時以連續軌跡、離散切片與多層曝光被保存。時間累積成形，又逐漸被釋放。

**Artistic references.** Chronophotography and long-exposure drawing, interpreted as abstract editorial space.

**Visual system / typography.** Copper traces, charcoal brown and a quiet ivory exposure. AFTER is a heavy counterweight to the airy arc volume. Palette: #332f31, #d49b69, #e3cfac.

**Composition and motion.** A copper arc lives in a charcoal-brown field, offset from an oversized editorial AFTER. Opening: one restrained outline. Transformation: continuous samples form a comb-like volume. Climax: twelve temporal cuts and three translucent exposures make duration visible. Emotion: meditative mystery. Fixed analytic history samples reconstruct every state directly; no frame buffer history or mouse trail is used. Timeline: 0s I / Presence → 3s II / Movement → 6s III / Memory → 10s IV / Accumulation → 15s V / Dissolution → 18s VI / Renewal; loop closes at 20s.

**Technical approach.** 150 continuous history samples, 12 discrete time cuts and 3 translucent exposures reconstruct the same analytic gesture at any time. Density grows before the current form releases its history. Dependencies: browser-native APIs and shared local modules only.

**Performance.** Fixed sample count, no accumulating frame buffer, no unbounded trail objects. Canvas resolution is capped.

**Accessibility / responsive.** Shared controls and reduced-motion still at 10s. Logical artboard adapts to portrait height; narrative descriptions remain outside the image.

**Known limitations.** Fixed sample counts can reveal comb-like spacing at large scale; this is intentional in the discrete cuts. It is a representation of remembered time, not photographic capture.

**Review.** Six positions: 0, 4, 8, 12, 16, 20s. See the itemized critical review and saved PNGs in “review/”.

## Research

- [MoMA: Lygia Clark, Poetic Shelter](https://www.moma.org/collection/works/91767) — the conceptual relationship of a plane and a spatial object.
- [pbrt: Specular Reflection and Transmission](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission) — Fresnel and refraction principles. The artwork intentionally uses reduced artistic models, documented above.

## Verification and completion

“npm run build” and “npm run lint” perform syntax and local HTML-reference checks across the Astra project. There is no TypeScript configuration or compilation step. Browser checks: “node scripts/qa-volume.cjs 2”; full-cycle sampled playback: “node scripts/qa-volume.cjs 2 --live”. The QA runner uses installed Playwright/Sharp and Chromium; set NODE_MODULES and CHROMIUM_PATH on another workstation.

The six works, pages, catalogue, documentation and browser review are implemented. Artistic scores are a candid internal assessment, not an exhibition certificate; not every piece is scored above 90. Hardware GPU performance, Safari/Firefox, physical mobile devices and independent curatorial judgment remain unverified. Exact executed results and limitations are in ART-DIRECTION-REVIEW.md and review/live-verification.json.
