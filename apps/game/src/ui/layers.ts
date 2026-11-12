// Map layers: Satisfação (seals on the homes), each service's reach, soil per crop, resources, districts,
// and Escoamento (approved in the review): a seal on every producer with the share of its surplus that
// reaches a buyer, over the routes from the fields to commerce, collection points and gateways.
import { BUILDINGS, type BuildingId, type GoodId } from '@assunguy/data';
import { connected, def, districtsUnlocked, geography, DISTRICT_COLORS, nameId, type LotKey } from '@assunguy/sim';
import * as store from '../store';
import { T, goodName, nameOf } from '../i18n';
import { api, vars, hooks, PT, EN } from '../view';
import { $, K, esc, hint, popup, closePopup, ico } from './kit';

const SERVICE_LAYER: [string, string, string][] = [
  ['water', 'Água', '<path d="M12 3c3 4.500 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6.500 6-11z"/>'],
  ['faith', 'Igreja', '<path d="M12 3v5M10 5h4M6 21V12l6-4 6 4v9M10 21v-4h4v4"/>'],
  ['school', 'Escola', '<path d="M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5"/>'],
  ['health', 'Botica', '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/>'],
  ['commerce', 'Comércio', '<path d="M4 9h16l-1 11H5zM8 9V7a4 4 0 0 1 8 0v2"/>'],
  ['culture', 'Cultura', '<path d="M4 6c5-2 11-2 16 0v5c0 5-4 9-8 9s-8-4-8-9z"/><path d="M9 11h.01M15 11h.01M9 15c2 1.500 4 1.500 6 0"/>'],
];
const ICON = {
  sat: '<circle cx="12" cy="12" r="8.500"/><path d="M8.500 14c1.800 2 5.200 2 7 0M9 9.500h.01M15 9.500h.01"/>',
  outlet: '<path d="M4 18c4 0 4-6 8-6s4-6 8-6"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2"/>',
  resources: '<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9z"/><path d="M12 12l8-4.500M12 12v9M12 12L4 7.500"/>',
  districts: '<path d="M3 5h8v6H3zM13 5h8v14h-8zM3 13h8v6H3z"/>',
};

export function openLayers(): void {
  const { s } = store.session(), r = store.ratings(), homes = Object.keys(r.homes).length, cur = vars.camada as string | null;
  const without = (sv: string) => Object.values(r.homes).filter((h) => h.items.some((i) => i.kind === 'outOfReach' && i.service === sv)).length;
  const bt = (id: string, title: string, sub: string, icon: string, info?: string) => `<div class="k-camw"><button type="button" class="k-cam${cur === id ? ' on' : ''}" data-layer="${esc(id)}">${ico(icon)}<b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>${info ? K.info(info) : ''}</div>`;
  const main = [bt('notas', T('ui.satisfaction'), T('ui.layers.satSub'), ICON.sat), bt('escoamento', T('ui.layers.outlet'), T('ui.layers.outletSub'), ICON.outlet, 'layerOutlet')];
  if (s.level >= (BUILDINGS.mine.minLevel ?? 1)) main.push(bt('recursos', T('ui.layers.resources'), T('ui.layers.resourcesSub', { n: Object.keys(s.map.buildings).length }), ICON.resources));
  if (districtsUnlocked(s)) main.push(bt('bairros', T('ui.colony.districts'), T('ui.layers.districtsSub', { n: store.districts().info.length }), ICON.districts));
  const services = SERVICE_LAYER.filter(([id]) => id !== 'culture' || s.level >= (BUILDINGS.theater.minLevel ?? 1)).map(([id, pt, icon]) => bt(pt, T(`service.${id}`), T('ui.layers.without', { n: without(id), of: homes }), icon, `layer_${id}`));
  const crops = [...new Set((Object.keys(BUILDINGS) as BuildingId[]).filter((t) => def(t).crop && (def(t).minLevel ?? 1) <= s.level && !def(t).lateGame).map((t) => def(t).output!.good as GoodId))];
  const soils = crops.map((g) => { const d = (api.ICONES as Record<string, string>)[PT.good[g] ?? g]; return `<div class="k-camw"><button type="button" class="k-cam${cur === `solo:${PT.good[g]}` ? ' on' : ''}" data-layer="solo:${PT.good[g]}">${d ? `<svg viewBox="0 0 512 512" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>` : ''}<b>${esc(goodName(g))}</b></button></div>`; });
  popup(T('ui.layers.title'), '', `<h3 class="cam-t">${esc(T('ui.layers.main'))}</h3><div class="cams">${main.join('')}</div><h3 class="cam-t">${esc(T('ui.layers.services'))}</h3><div class="cams">${services.join('')}</div><h3 class="cam-t">${esc(T('ui.layers.soil'))}</h3><div class="cams">${soils.join('')}</div>${cur ? K.actions([{ id: 'layerOff', text: T('ui.layers.off') }]) : ''}`);
  document.querySelectorAll<HTMLElement>('[data-layer]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); chooseLayer(b.dataset.layer as string); }; });
  const off = document.getElementById('layerOff');
  if (off) off.onclick = (e) => { e.stopPropagation(); chooseLayer('off'); };
}

export function chooseLayer(id: string): void {
  const cur = vars.camada as string | null;
  const next = id === 'off' || id === cur ? null : id;
  vars.camada = next; vars.verNotas = next === 'notas'; vars.filtroRec = 'todos';
  $('btSat').setAttribute('aria-pressed', String(!!next));
  closePopup();
  if (!next) return;
  if (next === 'escoamento') hint(T('ui.layers.outletHint'), 3500);
  else if (next.startsWith('solo:')) hint(T('ui.layers.soilHint'), 3500);
  else if (next === 'bairros') hint(T('ui.layers.districtsHint'), 3000);
  else if (next !== 'notas' && next !== 'recursos') {
    const sv = SERVICE_LAYER.find((x) => x[1] === next)?.[0] ?? '';
    const n = Object.values(store.ratings().homes).filter((h) => h.items.some((i) => i.kind === 'outOfReach' && i.service === sv)).length;
    hint(n ? T('ui.layers.missing', { n, service: sv }) : T('ui.layers.allReached'), 3500);
  }
}

// ---- the districts in the renderer's shape

let districtCache: { v: unknown; out: unknown } | null = null;
hooks.bairrosAtuais = () => {
  const D = store.districts();
  if (districtCache && districtCache.v === D) return districtCache.out;
  const info = D.info.map((d) => ({ id: d.id, nome: nameOf('district', JSON.stringify(d.name)), cor: DISTRICT_COLORS[d.color % DISTRICT_COLORS.length], casas: d.homes, centro: d.centre, arraial: d.hamlet, nid: nameId(d.name) }));
  const out = { celula: D.cell, info, lacos: D.outlines };
  districtCache = { v: D, out };
  return out;
};
hooks.goodName = (pt: string) => goodName((EN.good as Record<string, string>)[pt] ?? pt);
hooks.mostraFaixaRec = () => {};

// ---- Escoamento, drawn by the renderer's loop

const sealColor = (f: number) => (f >= 0.9 ? '#23407A' : f >= 0.75 ? '#7A5A12' : '#9C3A20');
hooks.drawOutlet = (ctx: CanvasRenderingContext2D) => {
  if (!store.hasGame()) return;
  const { s } = store.session(), c = store.economy(), z = api.cam.z as number;
  const P = (a: number, b: number): [number, number] => api.projT(...api.paraVista(a + 0.5, b + 0.5));
  const at = (k: LotKey) => { const [a, b] = k.split(',').map(Number) as [number, number]; return P(a, b); };
  ctx.save();
  ctx.fillStyle = 'rgba(246,240,226,.5)'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const G = geography(s, connected(s.map)), capOf: Record<string, number> = {};
  for (const x of c.transport.collections) capOf[x.key] = x.capacity;
  // each line with a light outline and arrows the way the cargo goes (the renderer's linhaFluxo)
  const line = (p: [number, number], q: [number, number], color: string, w: number, dash = false) => api.linhaFluxo(p, q, color, w, dash);
  ctx.globalAlpha = 0.92;
  for (const [key, pr] of Object.entries(G.producers) as [LotKey, (typeof G.producers)[LotKey]][]) {
    const o = c.outlet[key]; if (!o || o.sent < 1) continue;
    const w = Math.max(1.5, Math.min(5, Math.sqrt(o.sent) / 6)) * Math.max(0.7, z);
    // to its collection point: blue when it carries, grey when it has no vehicle; what still walks gets its own red line
    const col = pr.carry > 6 && pr.collections.length ? G.collections[pr.collections[0]!] : undefined, carries = !!col && (capOf[col.key] ?? 0) > 0;
    if (col) line(at(key), at(col.key), carries ? '#2A78D6' : '#8A8170', carries ? w : Math.max(1.2, w * 0.6), true);
    const walks = !col || !carries || o.lost.onFoot > o.sent * 0.1;
    const com = G.commerce[pr.carryTo]; if (com && !com.virtual && walks) line(at(key), at(com.key), pr.carry <= 6 ? '#3E7D3A' : '#B5452B', col ? Math.max(1.2, w * 0.7) : w);
  }
  for (const col of G.collections) { const best = col.to.slice().sort((a, b) => b.share - a.share)[0]; const com = best && G.commerce[best.j]; if (com && !com.virtual) line(at(col.key), at(com.key), '#2A78D6', 3 * Math.max(0.7, z)); }
  for (const com of G.commerce) {
    if (com.virtual || !com.linked) continue;
    const near = G.gateways.slice().sort((a, b) => dist(a.key, com.key) - dist(b.key, com.key))[0];
    if (near) line(at(com.key), at(near.key), '#23407A', 3.5 * Math.max(0.7, z));
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // gateways: how full they are
  for (const g of c.transport.gateways) { const [x, y] = at(g.key); api.letreiro(x, y - 46 * z, `${Math.round(Math.min(1, g.occupancy) * 100)}%`, 13); }
  // collection points: how full, or that they have no vehicle
  for (const x of c.transport.collections) { const [px, py] = at(x.key); api.letreiro(px, py - 46 * z, x.capacity > 0 ? `${Math.round(Math.min(1, x.occupancy) * 100)}%` : T('ui.layer.noVehicle'), 13); }
  // producers: the share that reaches a buyer
  ctx.font = '700 11px "Libre Franklin",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [key, o] of Object.entries(c.outlet) as [LotKey, (typeof c.outlet)[LotKey]][]) {
    if (o.sent < 1) continue;
    // a pill wide enough for "100%"
    const txt = `${Math.round(o.share * 100)}%`, [x, y0] = at(key), y = y0 - 30 * z, r = 13, w = Math.max(2 * r, ctx.measureText(txt).width + 10);
    ctx.fillStyle = sealColor(o.share); ctx.beginPath(); ctx.roundRect(x - w / 2, y - r, w, 2 * r, r); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#FBF4E4'; ctx.stroke();
    ctx.fillStyle = '#FBF4E4'; ctx.fillText(txt, x, y + 0.5);
  }
  ctx.restore();
};
const dist = (a: LotKey, b: LotKey) => { const [p, q] = a.split(',').map(Number) as [number, number], [r, t] = b.split(',').map(Number) as [number, number]; return Math.abs(p - r) + Math.abs(q - t); };
