# Motion Studies — Astra

An independent implementation of **MOTION STUDIES — VOL. 01 / The Poetry of Moving Forms**.

- [Open the collection](motion-vol01/index.html)
- [Art direction, artwork documentation and operating instructions](motion-vol01/README.md)
- [Review and verification report](motion-vol01/review/REPORT.md)

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

The work is isolated here. Existing `motion-graphics/` work and untracked changes are not modified. No remote publication or push is performed.
