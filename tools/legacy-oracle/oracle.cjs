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
  // whole seasons from each save, events resolved by a fixed policy (first option the colony can take);
  // the rules removed in the November review are switched off in the prototype too
  seasons: async (page) => {
    const out = {};
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load]) => {
        const state = (0, eval)(load)(txt);
        abreRelatorio = () => {}; salva = () => {}; salvaNuvem = () => {};
        const snap = () => JSON.parse(JSON.stringify({
          t: M.mercadoSim.t, seed: M.mercadoSim.semente, caixa: M.caixa, inf: M.influencia, nivelC: M.nivelC, marco: M.marco || 0, prazo: M.prazo, exig: M.exig || 0, verbaMod: M.verbaMod,
          fams: Object.values(M.fams).map((f) => [f.id, f.nome, f.oficio, f.hab, f.nova, f.parada, f.chegou, f.fundo]),
          predios: M.predios, nivel: M.nivel, efeitos: M.efeitos.map((e) => [e.sat, e.restam]), eventos: M.mercadoSim.eventos.map((e) => [e.b, e.tipo, e.f, e.restam]),
          notaCasa: M.notaCasa, vol: (M.transp || {}).vol, frenteIds: Object.keys(M.frenteIds || {}).sort(), usados: M.usados, agenda: M.agenda, prob: M.prob, abast: M.abast, variedade: M.variedade,
          plantio: M.plantio, escolhas: M.escolhas, gobras: M.gobras, aviso: !!M.aviso, atrasos: M.atrasos || 0, intervencao: !!M.intervencao, proxLeva: M.proxLeva, proxPedidoTroca: M.proxPedidoTroca, ultimoDilema: M.ultimoDilema,
          price: Object.fromEntries(Object.keys(M.mercadoSim.hist).map((b) => [b, M.mercadoSim.hist[b][M.mercadoSim.hist[b].length - 1]])),
        }));
        const seasons = [];
        for (let i = 0; i < 12; i++) {
          passaEstacao();
          const queued = M.fila.map((e) => JSON.parse(JSON.stringify(e)));
          const picks = [];
          let guard = 0;
          while (M.fila.length && guard++ < 20) {
            const ev = M.fila[0];
            if (ev.tipo === 'fim' || ev.tipo === 'vitoria') break;
            const d = defEvento(ev);
            const i0 = d.ops.findIndex((o) => !o.pode || o.pode(M));
            picks.push(i0);
            resolveEvento(i0);
          }
          seasons.push({ queued, picks, after: snap() });
          if (M.fila.length) break;
        }
        return { state, seasons };
      }, [txt, LOAD.toString()]);
    }
    return out;
  },

  // the advisor's list at the start and after each season of the same runs as `seasons`
  advice: async (page) => {
    const out = {};
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load]) => {
        // fotoColonia and faltasDaMeta re-rate the homes on the live state in the middle of the advice (a second pass of calcula,
        // which drifts when taxes weigh on the ratings); the port's advisor changes nothing, so neither does this
        fotoColonia = (0, eval)('(' + fotoColonia.toString().replace('sat: calcula(M).media', 'sat: C.media') + ')');
        faltasDaMeta = (0, eval)('(' + faltasDaMeta.toString().split('calcula(m).media').join('(m === M ? C.media : calcula(m).media)') + ')');
        (0, eval)(load)(txt);
        abreRelatorio = () => {}; salva = () => {}; salvaNuvem = () => {};
        // the prototype's caches key on counts, so an event that changes the colony without changing them leaves
        // them stale; the port has no caches, so they are cleared before each list
        const list = () => { C = calcula(M); cacheExcesso = null; cacheTroca = null; cacheInvestir = null; cacheDizimo = null; return conselhos().map((x) => ({ w: x.peso, tit: x.tit, sub: x.sub, ac: x.ac || null })); };
        const states = [list()];
        for (let i = 0; i < 12; i++) {
          passaEstacao();
          let guard = 0;
          while (M.fila.length && guard++ < 20) {
            const ev = M.fila[0];
            if (ev.tipo === 'fim' || ev.tipo === 'vitoria') break;
            const d = defEvento(ev);
            resolveEvento(d.ops.findIndex((o) => !o.pode || o.pode(M)));
          }
          states.push(list());
          if (M.fila.length) break;
        }
        return states;
      }, [txt, LOAD.toString()]);
    }
    return out;
  },

  // the advisor on variants of each save, so more of its rules fire: the change is recorded as data and the
  // port applies the same change before comparing
  adviceVariants: async (page) => {
    const out = {};
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load]) => {
        // fotoColonia and faltasDaMeta re-rate the homes on the live state in the middle of the advice (a second pass of calcula,
        // which drifts when taxes weigh on the ratings); the port's advisor changes nothing, so neither does this
        fotoColonia = (0, eval)('(' + fotoColonia.toString().replace('sat: calcula(M).media', 'sat: C.media') + ')');
        faltasDaMeta = (0, eval)('(' + faltasDaMeta.toString().split('calcula(m).media').join('(m === M ? C.media : calcula(m).media)') + ')');
        const free = (t, linked) => { for (const key of Object.keys(M.ruas)) { const [a, b] = par(key); for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const er = podeConstruir(M, t, a + x, b + y); if (!er) return k(a + x, b + y); } } return null; };
        const loose = (t) => { for (let a = 0; a < NX; a++) for (let b = 0; b < NY; b++) if (podeConstruir(M, t, a, b) === 'Precisa de rua ao lado') return k(a, b); return null; };
        const variants = {
          broke: () => ({ caixa: -200 }),
          rich: () => ({ caixa: 6000, nivelC: Math.min(11, (M.nivelC || 1) + 3) }),
          council: () => ({ caixa: 2000, add: { [free('camara')]: 'camara' } }),
          tithe: () => ({ add: { [free('camara')]: 'camara' }, dizimo: .2 }),
          loose: () => ({ add: { [loose('poco')]: 'poco' } }),
        };
        const res = {};
        for (const [v, make] of Object.entries(variants)) {
          (0, eval)(load)(txt);
          const spec = make();
          if (spec.caixa !== undefined) M.caixa = spec.caixa;
          if (spec.nivelC) M.nivelC = spec.nivelC;
          if (spec.add) Object.assign(M.predios, spec.add);
          if (spec.dizimo) M.leis.dizimo = { geral: spec.dizimo, por: {} };
          C = calcula(M); cacheExcesso = null; cacheTroca = null; cacheInvestir = null; cacheDizimo = null;
          res[v] = { spec, list: conselhos().map((x) => ({ w: x.peso, tit: x.tit, sub: x.sub, ac: x.ac || null })) };
        }
        return res;
      }, [txt, LOAD.toString()]);
    }
    return out;
  },

  // the player's commands, done the way the prototype's screens do them, then four seasons; a snapshot after
  // each command and each season. Arguments found here are recorded, so the port replays the same script.
  commands: async (page) => {
    const out = {};
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load]) => {
        const state = (0, eval)(load)(txt);
        abreRelatorio = () => {}; salva = () => {}; salvaNuvem = () => {}; aviso = () => {}; efx = () => {};
        const snap = () => JSON.parse(JSON.stringify({
          caixa: M.caixa, inf: M.influencia, obrasEst: M.obrasEst, exig: M.exig || 0, prazo: M.prazo, prazoPedido: !!M.prazoPedido,
          predios: M.predios, nivel: M.nivel, ruas: Object.keys(M.ruas).sort(), terras: M.terras, veic: M.veic || {}, tarifa: M.tarifa || {},
          fams: Object.keys(M.fams).sort(), notaCasa: M.notaCasa, plantio: M.plantio, arv: Object.keys(M.arv).length,
          pend: M.pend || {}, pendNivel: M.pendNivel || {}, pendNv0: M.pendNv0 || {}, pendRua: M.pendRua || {}, pendTroca: M.pendTroca || {},
          pendentes: M.pendentes || {}, pendC: M.pendC || {}, leisC: M.leisC || {}, gobras: M.gobras || {}, agente: !!M.agente,
        }));
        const free = (t, avoid = []) => { for (const key of Object.keys(M.ruas)) { const [a, b] = par(key); for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = k(a + x, b + y); if (avoid.includes(c)) continue; if (!podeConstruir(M, t, a + x, b + y)) return c; } } return null; };
        // the screens' handlers, inlined
        const build = (tipo, key) => { const [a, b] = par(key); medindo(() => { M.predios[key] = tipo; celulasDe(a, b, tipo).forEach(([x, y]) => { delete M.arv[k(x, y)]; }); }); M.caixa -= CUSTO[tipo] || 0; M.obrasEst += CUSTO[tipo] || 0; M.pend = M.pend || {}; M.pend[key] = CUSTO[tipo] || 0; mudou(); };
        const move = (origem, key) => { const tipo = M.predios[origem], [a, b] = par(key); medindo(() => {
            if (TIPOS[tipo].moradia) famsDaCasa(M, origem).forEach((f) => { const n0 = f.id.split('#')[1], novo = `${key}#${n0}`; delete M.fams[f.id]; f.id = novo; M.fams[novo] = f; if (M.vagos && M.vagos[f.id]) delete M.vagos[f.id]; });
            delete M.predios[origem]; if (M.nivel[origem]) { M.nivel[key] = M.nivel[origem]; delete M.nivel[origem]; }
            M.predios[key] = tipo; celulasDe(a, b, tipo).forEach(([x, y]) => { delete M.arv[k(x, y)]; }); });
          ['pend', 'pendNivel', 'pendNv0', 'pendTroca'].forEach((c) => { if (M[c] && origem in M[c]) { M[c][key] = M[c][origem]; delete M[c][origem]; } }); mudou(); };
        const demolish = (key) => { const devolve = ((M.pend || {})[key] || 0) + ((M.pendNivel || {})[key] || 0) + (((M.pendTroca || {})[key] || {}).custo || 0);
          medindo(() => { delete M.predios[key]; delete M.nivel[key]; });
          if (devolve) { M.caixa += devolve; M.obrasEst = Math.max(0, M.obrasEst - devolve); if (M.pend) delete M.pend[key]; if (M.pendNivel) delete M.pendNivel[key]; if (M.pendTroca) delete M.pendTroca[key]; } mudou(); };
        const upgrade = (key) => { const tipo = M.predios[key], custo = custoMelhoria(tipo, nivelDeKey(M, key)); M.caixa -= custo; M.obrasEst += custo;
          M.pendNivel = M.pendNivel || {}; M.pendNv0 = M.pendNv0 || {}; if (M.pendNivel[key] === undefined) M.pendNv0[key] = (M.nivel || {})[key]; M.pendNivel[key] = (M.pendNivel[key] || 0) + custo;
          M.nivel = M.nivel || {}; medindo(() => { M.nivel[key] = (M.nivel[key] || 0) + 1; }); mudou(); };
        const street = (cells) => { for (const [p, q] of cells) { if (M.ruas[k(p, q)]) continue; if (podeConstruir(M, 'rua', p, q) || M.caixa < CUSTO.rua) break; M.ruas[k(p, q)] = 1; delete M.arv[k(p, q)]; M.caixa -= CUSTO.rua; M.obrasEst += CUSTO.rua; M.ruasEst = (M.ruasEst || 0) + 1; M.pendRua = M.pendRua || {}; M.pendRua[k(p, q)] = CUSTO.rua; } mudou(); };
        const explore = (id) => { M.caixa -= CUSTO_EXPEDICAO; M.obrasEst += CUSTO_EXPEDICAO; M.terras[id] = 'vista'; cronica('x'); M.cronica.pop(); };
        const script = [], snaps = [];
        const run = (cmd) => { script.push(cmd); const [op, ...a] = cmd;
          if (op === 'build') build(a[0], a[1]); else if (op === 'move') move(a[0], a[1]); else if (op === 'demolish') demolish(a[0]); else if (op === 'upgrade') upgrade(a[0]);
          else if (op === 'streets') street(a[0]); else if (op === 'explore') explore(a[0]); else if (op === 'annex') { anexar(a[0]); mudou(); }
          else if (op === 'buy') compraVeiculo(a[0], a[1]); else if (op === 'sell') vendeVeiculo(a[0], a[1]); else if (op === 'margin') defineMargem(a[0], a[1]);
          else if (op === 'swap') trocaCultura(a[0], a[1]); else if (op === 'tax') { M.pendentes[a[0]] = a[1]; } else if (op === 'law') { M.pendC[a[0]] = true; C = calcula(M); }
          else if (op === 'funds') { soma({ inf: -4, caixa: 400, exig: 1 }); } else if (op === 'time') { soma({ inf: -6 }); M.prazo += 4; M.prazoPedido = true; }
          snaps.push(snap()); };
        M.caixa = 4000; M.influencia = Math.max(M.influencia, 12); M.nivelC = Math.max(M.nivelC || 1, TIPOS.camara.nv || 1); mudou();
        state.caixa = M.caixa; state.influencia = M.influencia; state.nivelC = M.nivelC;
        const hut = free('rancho'); run(['build', 'rancho', hut]);
        const field = free('rMilho', [hut]); run(['build', 'rMilho', field]);
        run(['build', 'igreja', free('igreja')]);
        const store = Object.keys(M.predios).find((x) => M.predios[x] === 'armazem'); run(['upgrade', store]);
        // a street line out of the network
        let line = null;
        for (const key of Object.keys(M.ruas)) { const [a, b] = par(key); for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cells = [1, 2, 3].map((i) => [a + x * i, b + y * i]); if (cells.every(([p, q]) => !M.ruas[k(p, q)] && !podeConstruir(M, 'rua', p, q))) { line = cells; break; } } if (line) break; }
        if (line) run(['streets', line]);
        run(['move', hut, free('rancho', [hut])]);
        run(['demolish', field]);
        const crop = Object.keys(M.predios).find((x) => M.predios[x] === 'rMilho' && !plantaVerde(M, x) && !(M.pend || {})[x]);
        if (crop) run(['swap', crop, 'rFeijao']);
        const hidden = Object.keys(TERRAS).find((id) => !M.terras[id] && vizinhaDeNossa(id));
        if (hidden) { run(['explore', hidden]); run(['annex', hidden]); }
        const port = Object.keys(M.predios).find((x) => M.predios[x] === 'porto');
        if (port) { run(['sell', port, 'canoa']); run(['buy', port, 'canoa']); run(['margin', port, .2]); }
        run(['build', 'camara', free('camara')]);
        run(['tax', 'dizimo', { geral: .08, por: {} }]);
        run(['law', 'feira']);
        run(['time']);
        run(['funds']);
        for (let i = 0; i < 4; i++) {
          passaEstacao();
          let guard = 0;
          while (M.fila.length && guard++ < 20) { const ev = M.fila[0]; if (ev.tipo === 'fim' || ev.tipo === 'vitoria') break; const d = defEvento(ev); resolveEvento(d.ops.findIndex((o) => !o.pode || o.pode(M))); }
          snaps.push({ ...snap(), rel: JSON.parse(JSON.stringify(M.relatorios[M.relatorios.length - 1] || null)) });
          if (M.fila.length) break;
        }
        return { state, script, snaps };
      }, [txt, LOAD.toString()]);
    }
    return out;
  },

  // a new game, built the way the prototype's "new colony" does, then eight seasons with the fixed event policy
  newGame: async (page) => {
    const out = {};
    for (const seed of [1869, 4242]) {
      out[seed] = await page.evaluate((seed) => {
        abreRelatorio = () => {}; salva = () => {}; salvaNuvem = () => {};
        geraMundo(seed, 2); limpaPedacos();
        M = mapaInicial(); M.mercadoSim = mercadoInicial(); sincronizaFamilias(M, true); atualizaAbast(economia(M));
        garanteEstado(M); M.fila.push({ tipo: 'intro' }); mudou();
        const start = JSON.parse(JSON.stringify(M));
        const seasons = [];
        // the intro decree first, then seasons
        while (M.fila.length) { const d = defEvento(M.fila[0]); resolveEvento(d.ops.findIndex((o) => !o.pode || o.pode(M))); }
        for (let i = 0; i < 8; i++) {
          passaEstacao();
          let guard = 0;
          while (M.fila.length && guard++ < 20) { const ev = M.fila[0]; if (ev.tipo === 'fim' || ev.tipo === 'vitoria') break; const d = defEvento(ev); resolveEvento(d.ops.findIndex((o) => !o.pode || o.pode(M))); }
          seasons.push(JSON.parse(JSON.stringify({ t: M.mercadoSim.t, caixa: M.caixa, inf: M.influencia, nivelC: M.nivelC, marco: M.marco || 0, predios: M.predios, nivel: M.nivel, fams: Object.keys(M.fams).sort(), notaCasa: M.notaCasa, fila: M.fila.length })));
        }
        return { start, seasons };
      }, seed);
    }
    return out;
  },

  // districts on each save: as they come, then remembering the first result, then with a player's name
  districts: async (page) => {
    const out = {};
    for (const [name, txt] of saves()) {
      out[name] = await page.evaluate(([txt, load]) => {
        (0, eval)(load)(txt);
        const take = () => { C = calcula(M); const B = calculaBairros(); return JSON.parse(JSON.stringify({ celula: B.celula, info: B.info.map((b) => ({ id: b.id, nome: b.nome, cor: CORES_BAIRRO.indexOf(b.cor), casas: b.casas, centro: b.centro, arraial: b.arraial })), lacos: B.lacos })); };
        const first = take();
        M.bairrosVistos = first.info.map((b) => b.id); M.bairrosArraial = first.info.filter((b) => b.arraial).map((b) => b.id);
        // more homes on new streets, so the remembered anchors have to hold new ones
        const extra = [];
        for (const key of Object.keys(M.ruas)) { const [a, b] = par(key); for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (extra.length >= 6) break; if (!podeConstruir(M, 'rancho', a + x, b + y)) { M.predios[k(a + x, b + y)] = 'rancho'; extra.push(k(a + x, b + y)); } } }
        const remembered = take();
        M.bairroNome = { [first.info[0].id]: 'Praça Velha' };
        const named = take();
        return { first, extra, remembered, named, seen: M.bairrosVistos, hamlets: M.bairrosArraial };
      }, [txt, LOAD.toString()]);
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
  // rules removed in the November review are switched off here too, so the port compares like with like
  await page.evaluate(() => {
    const patch = (fn, from, to) => { const src = fn.toString(); if (!src.includes(from)) throw new Error('patch target missing: ' + from.slice(0, 50)); return (0, eval)('(' + src.replace(from, to) + ')'); };
    cobraParcelas = () => ({ recebido: 0, pagas: 0, atrasos: 0, perderam: [] });
    prestaContas = patch(prestaContas, "if (parte < .2) { nota += 1; razoes.push('parcelas em dia'); } else if (parte > .4) { nota -= 1; razoes.push('muitas parcelas atrasadas'); }", '');
    pedidoDeTroca = patch(pedidoDeTroca, '(f.parcelas || 0) >= 5', 'M.mercadoSim.t - f.chegou >= 24');
    prepGeo = patch(prepGeo, 'if (dL > LOMBO_LIVRE) {', 'if (false) {');
    // balance review: the settlement grant and the share of trade from the start
    MARCOS[0].verba = 160; MARCOS[0].repasse = .1;
    prepGeo = patch(prepGeo, 'cap.forEach((c, i) => { if (distK(key, c.key) <= c.al) caps.push(i); });', 'if (dL > LOMBO_LIVRE) cap.forEach((c, i) => { if (distK(key, c.key) <= c.al) caps.push(i); });');
  });
  const out = await SCENARIOS[name](page, process.argv[3]);
  fs.mkdirSync(FIXTURES, { recursive: true });
  fs.writeFileSync(path.join(FIXTURES, `${name}.json`), JSON.stringify(out));
  console.log(`wrote fixtures/${name}.json`);
  await browser.close();
  server.close();
})();
