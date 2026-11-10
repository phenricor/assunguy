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

const SAVES = path.join(ROOT, 'legacy', 'saves');
const saves = () => fs.readdirSync(SAVES).filter((f) => f.endsWith('.json')).sort().map((f) => [f.replace(/\.json$/, ''), fs.readFileSync(path.join(SAVES, f), 'utf8')]);
// loads a save the way the prototype does when the player switches colony, and returns the normalized state
const LOAD = (txt) => {
  const novo = JSON.parse(txt);
  geraMundo(novo.semente, novo.mapaV || 1);
  M = garanteEstado(novo); migraNucleos(); sincronizaSaida(); C = calcula(M);
  return JSON.parse(JSON.stringify(M));
};

const SCENARIOS = {
  // the outside market from its fixed seed, then 24 more seasons
  market: async (page) => page.evaluate(() => {
    const mc = mercadoInicial();
    const start = JSON.parse(JSON.stringify(mc));
    const seasons = [];
    for (let i = 0; i < 24; i++) { passaMercado(mc); seasons.push({ t: mc.t, seed: mc.semente, prices: Object.fromEntries(Object.keys(mc.hist).map((b) => [b, mc.hist[b][mc.hist[b].length - 1]])), shocks: mc.eventos.map((e) => ({ b: e.b, tipo: e.tipo, f: e.f, restam: e.restam })) }); }
    return { start: { t: start.t, seed: start.semente, prices: Object.fromEntries(Object.keys(start.hist).map((b) => [b, start.hist[b]])) }, seasons };
  }),
  // the generated world for a few seeds: river, lands, deposits, sampled heights and the next draws
  world: async (page) => page.evaluate(() => {
    const cases = [[1, 2], [42, 2], [1869, 2], [123456789, 2], [987654321, 2], [77, 1]];
    return cases.map(([seed, v]) => {
      geraMundo(seed, v);
      const lands = {};
      for (const id of Object.keys(TERRAS)) {
        const t = TERRAS[id], upper = t.nome.endsWith(' de Cima'), base = upper ? t.nome.slice(0, -8) : t.nome;
        lands[id] = { biome: t.bioma, place: id === SEDE_ID ? 'seat' : BIOMAS[t.bioma].nomes.indexOf(base), upper, forest: t.mata, soil: t.solo };
      }
      const heights = [];
      for (let i = 0; i <= NX; i += 7) for (let j = 0; j <= NY; j += 5) heights.push([i, j, ALT[i][j]]);
      return { seed, version: v, phases: FASES, bank: MARGEM, width: LARGURA, water: AGUA.size, lands, deposits: VEIOS, heights, next: [RND(), RND(), RND()] };
    });
  }),
  // a new game's map: streets, buildings, trees, known lands and the nature drawn around them
  map: async (page) => page.evaluate(() => {
    return [[1869, 2], [42, 2], [987654321, 2], [77, 1]].map(([seed, v]) => {
      geraMundo(seed, v);
      const m = mapaInicial(), g = geraNatureza(m);
      Object.keys(g.nat).forEach((key) => { delete m.arv[key]; });
      return { seed, version: v, streets: Object.keys(m.ruas), buildings: m.predios, trees: m.arv, lands: m.terras, nature: g.nat, names: g.nomes, next: [RND(), RND()] };
    });
  }),
  // the playtester's saves: street network, linked buildings and how far each service reaches
  network: async (page) => {
    const out = {};
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load]) => {
        const state = (0, eval)(load)(txt);
        const reach = {};
        for (const key in M.predios) if (TIPOS[M.predios[key]].serv) { const r = raioDe(M, key); reach[key] = { radius: r, dist: Object.fromEntries(alcance(M, key, r)) }; }
        return { state, network: [...redePrincipal(M)].sort(), linked: [...ligados(M)].sort(), reach };
      }, [txt, LOAD.toString()]);
    }
    return out;
  },
  // one season's economy (three simulated years, the last one kept) for each playtester save
  economy: async (page) => {
    const out = {};
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load]) => {
        const state = (0, eval)(load)(txt);
        const c = economiaSem(M);
        const pick = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => Math.abs(v) > 1e-9));
        const per = {}; for (const k of ['prod', 'proprio', 'mercado', 'fora', 'frete', 'perda', 'renda', 'proc', 'procura', 'fat']) per[k] = pick(c[k]);
        const a = c.e.a;
        return {
          state,
          per, estoque: pick(c.estoque), imp: { dizimo: pick(c.imp.dizimo), fora: pick(c.imp.fora) },
          scalars: { fome: c.fome, faltaProdutor: c.faltaProdutor, demMercado: c.demMercado, viaC: c.viaC, viaT: c.viaT, rendaTotal: c.rendaTotal, perdaTotal: c.perdaTotal, prodTotal: c.prodTotal, foraTotal: c.foraTotal, mercadoTotal: c.mercadoTotal, proprioTotal: c.proprioTotal, fatTotal: c.fatTotal, subsistencia: c.subsistencia, excedente: c.excedente },
          perdaPor: c.perdaPor, arrec: c.arrec,
          e: { n: c.e.n, fam: c.e.fam, vagas: c.e.vagas, rend: c.e.rend, mercado: c.e.mercado, tropas: c.e.tropas, somaF: c.e.somaF, veios: c.e.veios, semLigacao: c.e.semLigacao },
          alloc: { setor: Object.fromEntries(Object.entries(a.setor).map(([k, v]) => [k, { vagas: v.vagas, ocup: v.ocup, ef: v.ef, rend: v.rend }])), livres: a.livres.map((f) => f.id), ocupadas: a.ocupadas, por: Object.fromEntries(Object.entries(a.por).map(([k, v]) => [k, v.fams.map((f) => f.id)])) },
          transp: { caps: c.transp.caps.map((x) => ({ key: x.key, capEst: x.capEst, leva: x.leva, lombo: x.lombo, tarifa: x.tarifa, pico: x.pico })), portas: c.transp.portas.map((x) => ({ key: x.key, capEst: x.capEst, vol: x.vol, tarifa: x.tarifa, pico: x.pico, dests: x.dests })), modo: c.transp.modo, aprov: c.transp.aprov, perdV: c.transp.perdV, tarifas: c.transp.tarifas, custoEst: c.transp.custoEst, terras: c.transp.terras.map((x) => ({ id: x.id, prodV: x.prodV, perdeV: x.perdeV, lomboV: x.lomboV, coberto: x.coberto })) },
        };
      }, [txt, LOAD.toString()]);
    }
    return out;
  },
  // home ratings, health and tax burden; the speedrun save is also rated with taxes in force
  ratings: async (page) => {
    const out = {};
    const variants = [];
    for (const [name, txt] of saves()) { variants.push([name, txt, null]); if (name === 'speedrun') variants.push([name + '-taxed', txt, { lote: { geral: 4 }, dizimo: { geral: 0.1, por: { milho: 0.14 } }, exportacao: { geral: 0.06, por: { feijao: 0.1 } }, negocio: { geral: 10 } }]); }
    for (const [name, txt, leis] of variants) {
      out[name] = await page.evaluate(([txt, load, leis]) => {
        let state = (0, eval)(load)(txt);
        if (leis) { M.leis = leis; state = JSON.parse(JSON.stringify(M)); }
        const R = calcula(M);
        const num = (v) => (v === 'máx. 20' ? 'cap' : Number(String(v).replace('−', '-').replace('+', '')));
        const ef = leis ? efeitoImpostos(M) : null;
        return { state, media: R.media, fams: R.fams, saude: M.saude, lig: [...R.lig].sort(),
          notas: Object.fromEntries(Object.entries(R.notas).map(([k, n]) => [k, { nota: n.nota, vals: n.itens.map((i) => num(i.val)) }])),
          taxes: ef && { grupos: ef.grupos.map((g) => ({ g: g.g, fam: g.fam, antes: g.antes, depois: g.depois, total: g.total, peso: g.peso, queda: g.queda })), riscoFam: ef.riscoFam, riscoNegocios: ef.riscoNegocios, receita: ef.receita } };
      }, [txt, LOAD.toString(), leis]);
    }
    return out;
  },
  // families: a new game's founders, newcomers by origin, and one season of idling, supply and saving
  families: async (page) => {
    const fresh = await page.evaluate(() => {
      geraMundo(1869, 2);
      const m = mapaInicial(); m.mercadoSim = mercadoInicial(); sincronizaFamilias(m, true);
      const newcomers = [];
      for (const o of [undefined, ...Object.keys(PERFIL)]) for (const id of ['20,53#0', '31,49#1', '45,12#3']) newcomers.push({ id, o, f: novaFamilia(id, true, o) });
      return { founders: m.fams, newcomers };
    });
    const [, txt] = saves().find(([n]) => n === 'speedrun');
    const season = await page.evaluate(([txt, load]) => {
      const state = (0, eval)(load)(txt);
      passaFamilias(M);
      const afterPass = Object.fromEntries(Object.values(M.fams).map((f) => [f.id, [f.nova, f.parada]]));
      const c1 = economiaSem(M); atualizaAbast(c1);
      const supply = { abast: M.abast, variedade: M.variedade };
      const done = familiasInvestem(M, c1);
      return { state, afterPass, supply, done, savings: Object.fromEntries(Object.values(M.fams).map((f) => [f.id, f.fundo])), predios: M.predios, nivel: M.nivel, vagas: vagasDeMoradia(M) };
    }, [txt, LOAD.toString()]);
    return { ...fresh, season };
  },
  // the purse and the province: upkeep, grant, relief works, great works, transport, report and goals
  province: async (page) => {
    const out = {};
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load]) => {
        const L = (0, eval)(load);
        const state = L(txt);
        const manut = Object.values(M.predios).reduce((x, t) => x + manutencaoDe(t), 0) + Object.keys(M.ruas).length * manutRua(M) + manutObras(M) + servicoUrbano(M);
        const verba = Math.round(MARCOS[M.marco || 0].verba * (M.verbaMod || 1) * fatorVerbaEvento(M));
        const plan = planoFrente(M);
        const ritmo = ritmoDaMeta(M);
        const faltas = faltasDaMeta(M, MARCOS[(M.marco || 0) + 1]).map((x) => [x.ok, x.atual]);
        const req = requisitosDoNivel((M.nivelC || 1) + 1, economiaSem(M)).map((x) => [x.ok, x.atual]);
        const conta = prestaContas(M, -600, economiaSem(M));
        L(txt); const n1 = []; const custoFrente = aplicaFrente(n1);
        const relief = { ids: Object.keys(M.frenteIds).sort(), caixa: M.caixa, frete: M.frenteFrete, custo: custoFrente };
        L(txt); const tr = avancaTransporte([]);
        const transp = { tr, transp: M.transp, caixa: M.caixa, hist: M.histT[M.histT.length - 1] };
        L(txt); M.caixa = 5000; M.gobras = { telegrafo: { ativo: true, pago: 7, extra: 1.2 }, hospital: { ativo: true, pago: 0, extra: 0.4 }, usinaCal: { ativo: true, pago: 2, parou: true } };
        const n2 = []; const pago = avancaGrandesObras(n2);
        const works = { pago, gobras: M.gobras, caixa: M.caixa, n: n2.length, inf: M.influencia };
        return { state, manut, verba, plan: { itens: plan.itens.map((x) => [x.id, x.q, x.tem]), q: plan.q, custo: plan.custo, frete: plan.frete }, ritmo, faltas, req, conta: { razoes: conta.razoes, mod: conta.mod }, relief, transp, works };
      }, [txt, LOAD.toString()]);
    }
    return out;
  },
  // where each building type (and a street) may go, on every lot around the colony
  placement: async (page) => {
    const [, txt] = saves().find(([n]) => n === 'speedrun');
    return page.evaluate(([txt, load]) => {
      const state = (0, eval)(load)(txt);
      const keys = Object.keys(M.predios).concat(Object.keys(M.ruas)).map(par);
      const a0 = Math.min(...keys.map((p) => p[0])) - 8, a1 = Math.max(...keys.map((p) => p[0])) + 8, b0 = Math.min(...keys.map((p) => p[1])) - 8, b1 = Math.max(...keys.map((p) => p[1])) + 8;
      const types = ['rua', 'rancho', 'rMilho', 'rArroz', 'porto', 'pesqueiro', 'moinho', 'mina', 'erval', 'armazem', 'mercado', 'embarcadouro', 'igreja', 'engenho2'];
      const msgs = [''], out = {};
      for (const t of types) { let o = ''; for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { const r = podeConstruir(M, t, a, b); let i = msgs.indexOf(r); if (i < 0) { msgs.push(r); i = msgs.length - 1; } o += String.fromCharCode(65 + i); } out[t] = o; }
      return { state, box: [a0, a1, b0, b1], msgs, out };
    }, [txt, LOAD.toString()]);
  },
  // the economy with hypothetical buildings placed on real lots, as the advisor measures them
  measure: async (page) => {
    const out = {};
    const extras = [{ rMilho: 1 }, { rFeijao: 2 }, { rArroz: 1 }, { armazem: 1 }, { monjolo: 1 }, { chiqueiro: 1 }, { rancho: 2 }, { curral: 1 }, { serraria: 1 }, { rendimento: { lavoura: 1.1 } }, { rMilho: 1, monjolo: 1 }];
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load, extras]) => {
        const state = (0, eval)(load)(txt);
        memoEco = null; cacheLotes = null;
        return { state, runs: extras.map((x) => { const c = economia(M, x); return { x, renda: c.rendaTotal, fora: c.foraTotal, perda: c.perdaTotal }; }) };
      }, [txt, LOAD.toString(), extras]);
    }
    return out;
  },
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
