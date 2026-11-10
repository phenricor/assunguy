import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The prototype's static markup and its sprite generator (plus the game's bird models and adult araucaria) go into the page itself: the renderer looks the
// generator up by id (to start Web Workers from its text) and expects the markup when it loads.
const renderShell = (): Plugin => ({
  name: 'render-shell',
  transformIndexHtml(html) {
    const body = readFileSync(new URL('./src/render/body.html', import.meta.url), 'utf8');
    const gen = readFileSync(new URL('./src/render/spr3d.js', import.meta.url), 'utf8');
    // the game's own models (the river birds) go after the prototype's generator, which stays as it was
    const birds = readFileSync(new URL('./src/birdModels.js', import.meta.url), 'utf8');
    let source = JSON.parse(gen.slice(gen.indexOf('export const SOURCE = ') + 22, gen.lastIndexOf(';'))) as string;
    // the adult araucaria is the game's own (wider and fuller, like the real tree): it replaces the prototype's function
    const a = source.indexOf('  function araucaria(r, x, y, H) {'), b = source.indexOf('  // araucária jovem');
    if (a < 0 || b < a) throw new Error('render-shell: araucaria() not found in the sprite generator');
    source = source.slice(0, a) + readFileSync(new URL('./src/araucaria.js', import.meta.url), 'utf8') + source.slice(b) + '\n' + birds;
    return html.replace('<!--render-body-->', body).replace('<!--render-generator-->', `<script id="gerador">${source.replace(/<\/script/gi, '<\\/script')}</script>`);
  },
});

// One self-contained HTML file: scripts, styles and the sprite sheets inline, so the game runs offline.
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [renderShell(), viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 8000 },
  server: { host: true },
});
