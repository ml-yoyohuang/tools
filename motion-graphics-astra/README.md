# Motion Studies — Astra

An independent implementation of **MOTION STUDIES**.

- [Open the collection](motion-vol01/index.html)
- [Art direction, artwork documentation and operating instructions](motion-vol01/README.md)
- [Review and verification report](motion-vol01/review/REPORT.md)
- [Vol. 02 — The Materiality of Motion](motion-vol02/index.html)
- [Vol. 02 documentation](motion-vol02/README.md) · [Critical review](motion-vol02/ART-DIRECTION-REVIEW.md)
- [Vol. 03 — The Illusion of Perception](motion-vol03/index.html)
- [Vol. 03 documentation](motion-vol03/README.md) · [Critical review](motion-vol03/ART-DIRECTION-REVIEW.md)

Run from this directory:

```sh
npm run dev
```

Open `http://127.0.0.1:4178/motion-vol01/`. This is a static HTML / CSS / ES modules project with no runtime package dependencies. Serve over HTTP; ES module loading is not supported by opening the HTML directly with `file://`.

```sh
npm run build
npm run lint
```

Both commands run the dependency-free syntax and local-reference checker. There is no transpilation, bundler or TypeScript configuration in this independent static project. The unrelated `jlpt/` application is not part of this build.

Browser QA is reproducible with `node scripts/qa.cjs` and `node scripts/playback-qa.cjs` while the local server runs. These scripts use the desktop runtime's installed Playwright, Sharp and Chromium headless shell. On another workstation, set `NODE_MODULES` to a directory containing `playwright` and `sharp`, and `CHROMIUM_PATH` to your installed browser. No QA dependencies are required to view the artwork.

`scripts/generate.mjs` generates the seven HTML pages and original botanical SVGs. Artwork rendering lives in `motion-vol01/shared/`; this is the source to edit for visual changes. The QA script regenerates the six local WebP catalogue previews from the real artwork.

The work is isolated here. Existing `motion-graphics/` work and unrelated changes are not modified. Vol. 02 and Vol. 03 are delivered as separate commits and pushes to the feature branch at the user's request; this does not deploy a public website.

Volumes 02/03 share `common/player.js` for deterministic controls, lifecycle and accessibility, and retain independent artwork renderers. `node scripts/generate-volume.mjs 2` regenerates Vol. 02 HTML and art briefs; `node scripts/qa-volume.cjs 2 --live` runs browser checks and regenerates previews/review images. Substitute 3 for Vol. 03 when present.
