// Legacy oracle: runs the frozen prototype (legacy/prototype/index.html) in a headless browser and records
// what its rules produce, so the TypeScript port can be checked number by number.
//
//   node tools/legacy-oracle/oracle.cjs <scenario> [save.json]
//
// Scenarios write JSON fixtures to packages/sim/test/fixtures/. Playwright comes from the machine's tools.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROTO = path.join(ROOT, 'legacy', 'prototype');
const FIXTURES = path.join(ROOT, 'packages', 'sim', 'test', 'fixtures');

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(PROTO, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(PROTO) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, () => resolve(server));
  });
}

const SCENARIOS = {
  // the outside market from its fixed seed, then 24 more seasons
  market: async (page) => page.evaluate(() => {
    const mc = mercadoInicial();
    const start = JSON.parse(JSON.stringify(mc));
    const seasons = [];
    for (let i = 0; i < 24; i++) { passaMercado(mc); seasons.push({ t: mc.t, seed: mc.semente, prices: Object.fromEntries(Object.keys(mc.hist).map((b) => [b, mc.hist[b][mc.hist[b].length - 1]])), shocks: mc.eventos.map((e) => ({ b: e.b, tipo: e.tipo, f: e.f, restam: e.restam })) }); }
    return { start: { t: start.t, seed: start.semente, prices: Object.fromEntries(Object.keys(start.hist).map((b) => [b, start.hist[b]])) }, seasons };
  }),
};

(async () => {
  const name = process.argv[2];
  if (!SCENARIOS[name]) { console.error(`unknown scenario ${name}; known: ${Object.keys(SCENARIOS).join(', ')}`); process.exit(2); }
  const { chromium } = require('playwright');
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForFunction(() => typeof mercadoInicial === 'function');
  const out = await SCENARIOS[name](page, process.argv[3]);
  fs.mkdirSync(FIXTURES, { recursive: true });
  fs.writeFileSync(path.join(FIXTURES, `${name}.json`), JSON.stringify(out));
  console.log(`wrote fixtures/${name}.json`);
  await browser.close();
  server.close();
})();
