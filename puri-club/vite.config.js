import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Source lives in src/. The build is one self-contained index.html written next to src/, so this folder deploys as
// /tools/puri-club/. Images stay as files in assets/, referenced by relative URLs at runtime and never bundled.
const here = import.meta.dirname;
const assetsDir = resolve(here, "assets");
const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };

// The dev server's root is src/, so it serves ../assets at /assets itself.
function serveAssets() {
  return {
    name: "serve-assets",
    configureServer(server) {
      server.middlewares.use("/assets", (req, res, next) => {
        const file = resolve(assetsDir, "." + decodeURIComponent(req.url.split("?")[0]));
        if (!file.startsWith(assetsDir + sep)) return next();
        try {
          if (!statSync(file).isFile()) return next();
        } catch {
          return next();
        }
        res.setHeader("Content-Type", types[extname(file).toLowerCase()] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: resolve(here, "src"),
  base: "./",
  publicDir: false,
  plugins: [serveAssets(), viteSingleFile()],
  // outDir is this folder, which also holds src/ and assets/, so it must never be emptied.
  build: { outDir: here, emptyOutDir: false },
});
