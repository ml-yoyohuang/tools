// Bundles tests/unit/*.test.ts with esbuild (shipped with Vite) and runs them in Node.
import { build } from 'esbuild';
import { readdirSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const dir = 'tests/unit';
const out = 'test-results/unit';
mkdirSync(out, { recursive: true });
let failed = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.ts'))) {
  const outfile = join(out, f.replace(/\.ts$/, '.mjs'));
  await build({ entryPoints: [join(dir, f)], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error', external: ['gsap'] });
  const r = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
