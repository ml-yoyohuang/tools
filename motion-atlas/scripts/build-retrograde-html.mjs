import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ['standalone/retrograde.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  legalComments: 'inline',
  write: false,
});
const template = readFileSync(resolve(root, 'standalone/retrograde.template.html'), 'utf8');
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const image = readFileSync(resolve(root, 'planet-retrograde-og.png'));
const hostedImageUrl = process.env.RETROGRADE_OG_IMAGE_URL;
if (hostedImageUrl && !/^https:\/\/[^\s"<>]+$/i.test(hostedImageUrl)) {
  throw new Error('RETROGRADE_OG_IMAGE_URL must be an absolute HTTPS URL.');
}
const imageUrl = hostedImageUrl ?? `data:image/png;base64,${image.toString('base64')}`;
const html = template
  .replaceAll('/* INLINE_OG_IMAGE */', () => imageUrl.replaceAll('&', '&amp;'))
  .replace('/* INLINE_SCRIPT */', () => script);
const output = resolve(root, 'planet-retrograde.html');
writeFileSync(output, html);
console.log(`Created ${output} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB); no external runtime assets.`);
