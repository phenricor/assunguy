import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The prototype's static markup and its sprite generator (plus the game's bird models) go into the page itself: the renderer looks the
// generator up by id (to start Web Workers from its text) and expects the markup when it loads.
const legacyShell = (): Plugin => ({
  name: 'legacy-shell',
  transformIndexHtml(html) {
    const body = readFileSync(new URL('./src/legacy/body.html', import.meta.url), 'utf8');
    const gen = readFileSync(new URL('./src/legacy/spr3d.js', import.meta.url), 'utf8');
    // the game's own models (the river birds) go after the prototype's generator, which stays as it was
    const birds = readFileSync(new URL('./src/birdModels.js', import.meta.url), 'utf8');
    const source = (JSON.parse(gen.slice(gen.indexOf('export const SOURCE = ') + 22, gen.lastIndexOf(';'))) as string) + '\n' + birds;
    return html.replace('<!--legacy-body-->', body).replace('<!--legacy-generator-->', `<script id="gerador">${source.replace(/<\/script/gi, '<\\/script')}</script>`);
  },
});

// One self-contained HTML file: scripts, styles and the sprite sheets inline, so the game runs offline.
export default defineConfig({
  plugins: [legacyShell(), viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 8000 },
  server: { host: true },
});
