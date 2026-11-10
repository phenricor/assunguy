// The interface kit: every screen is built from these pieces, as HTML strings, with the prototype's markup
// and class names (its stylesheet is reused unchanged). Port of the prototype's `K`.
import { T, num } from '../i18n';

export const $ = <E extends HTMLElement = HTMLElement>(id: string): E => document.getElementById(id) as E;
export const esc = (s: string | number): string => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
export const X_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export const ico = (d: string): string => `<svg class="lin" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const fmt = (v: number): string => num(Math.round(v));
export const signed = (v: number): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;
export const signedMoney = (v: number): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}$ ${fmt(Math.abs(v))}`;

export interface Card { ic?: string; title: string; sub?: string; right?: string | number; rightSub?: string; tone?: string; body?: string; attrs?: string; active?: boolean; dim?: boolean }
export interface Action { id?: string; kind?: string; text: string; disabled?: boolean; attrs?: string }
export interface Series { name: string; values: (number | null)[]; color: string; label?: string }

const axisStep = (m: number): number => { const b = 10 ** Math.floor(Math.log10(Math.max(1e-9, m))); return [0.5, 1, 2, 5, 10].map((f) => f * b).find((p) => m / p <= 2) ?? b * 10; };

export const K = {
  info: (key: string) => `<button type="button" class="k-info" data-info="${key}" aria-label="${esc(T('ui.kit.more'))}">i</button>`,
  section: (t: string, info?: string) => `<h3 class="k-sec"><span>${t}</span>${info ? K.info(info) : ''}</h3>`,
  tabs: (list: [string, string][], current: string, name = 'aba') => `<div class="abas" role="tablist">${list.map(([id, txt]) => `<button type="button" role="tab" data-${name}="${id}" aria-selected="${id === current}">${txt}</button>`).join('')}</div>`,
  tiles: (items: { v: string | number; r: string; bad?: boolean }[]) => `<div class="tiles">${items.map((x) => `<div class="${x.bad ? 'alerta' : ''}"><b ${String(x.v).replace(/<[^>]*>/g, '').length > 9 ? 'style="font-size:14px"' : ''}>${x.v}</b><span>${x.r}</span></div>`).join('')}</div>`,
  row: (label: string, value?: string | number, tone?: string) => `<li class="${tone ?? ''}"><span>${label}</span><span>${value ?? ''}</span></li>`,
  rows: (items: string[]) => `<ul class="linhas">${items.join('')}</ul>`,
  bar: (f: number, color?: string) => `<span class="barra"><i style="width:${Math.max(0, Math.min(1, f)) * 100}%${color ? `;background:${color}` : ''}"></i></span>`,
  card: (c: Card) => {
    const inner = `<div class="cartao-t">${c.ic ? `<span class="cartao-ic">${c.ic}</span>` : ''}<div class="cartao-n"><b>${c.title}</b>${c.sub ? `<small>${c.sub}</small>` : ''}</div>${c.right !== undefined ? `<div class="cartao-d"><b class="${c.tone ?? ''}">${c.right}</b>${c.rightSub ? `<small>${c.rightSub}</small>` : ''}</div>` : ''}</div>${c.body ?? ''}`;
    const cl = `cartao${c.active ? ' ativo' : ''}${c.dim ? ' apagado' : ''}`;
    return c.attrs ? `<button type="button" class="${cl}" ${c.attrs}>${inner}</button>` : `<div class="${cl}">${inner}</div>`;
  },
  cards: (items: string[]) => `<div class="cartoes">${items.join('')}</div>`,
  chips: (list: [string, string][], current: string, name: string) => `<div class="chips">${list.map(([id, txt]) => `<button type="button" data-${name}="${id}" aria-pressed="${id === current}">${txt}</button>`).join('')}</div>`,
  actions: (items: Action[]) => `<div class="acoes">${items.map((b) => `<button type="button" ${b.id ? `id="${b.id}"` : ''} class="${b.kind ?? ''}" ${b.disabled ? 'disabled' : ''} ${b.attrs ?? ''}>${b.text}</button>`).join('')}</div>`,
  note: (txt: string, tone?: string) => `<p class="nota ${tone ?? ''}">${txt}</p>`,
  empty: (txt: string) => `<p class="vazio">${txt}</p>`,
  legend: (items: [string, string][]) => `<ul class="legenda">${items.map(([c, t]) => `<li><i style="background:${c}"></i>${t}</li>`).join('')}</ul>`,
  toggle: (id: string, txt: string, on: boolean) => `<button type="button" class="alterna" id="${id}" role="switch" aria-checked="${on}"><span>${txt}</span><i></i></button>`,
  /** A line chart; tapping it reads the values of that season. */
  chart: ({ series, labels, unit, summary, digits, base }: { series: Series[]; labels: string[]; unit?: string; summary?: string; digits?: number; base?: number }) => {
    const W = 340, H = 112, E = 30, D = 6, Tp = 8, B = 20, n = labels.length;
    const all = series.flatMap((x) => x.values.filter((v): v is number => v !== null));
    const b0 = base ?? 0, step = axisStep(Math.max(digits ? 0.2 : 1, Math.max(0, ...all) - b0));
    const top = Math.max(b0 + step, b0 + Math.ceil((Math.max(1e-6, ...all) - b0) / step) * step);
    const fv = (v: number) => (digits ? num(v, digits) : fmt(v));
    const X = (i: number) => E + (n > 1 ? (i / (n - 1)) * (W - E - D) : 0), Y = (v: number) => Tp + (1 - (v - b0) / (top - b0)) * (H - Tp - B);
    const grid = [0, 0.5, 1].map((f) => { const v = b0 + (top - b0) * f, y = Y(v); return `<line x1="${E}" x2="${W - D}" y1="${y}" y2="${y}" class="gr-g"/><text x="${E - 4}" y="${y + 3.5}" text-anchor="end" class="gr-t">${fv(v)}</text>`; }).join('');
    const lines = series.map((x) => {
      let d = '', open = false;
      x.values.forEach((v, i) => { if (v === null) { open = false; return; } d += `${open ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`; open = true; });
      const last = x.values.reduce<number>((a, v, i) => (v === null ? a : i), -1);
      return `<path d="${d}" fill="none" stroke="${x.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${last >= 0 ? `<circle cx="${X(last).toFixed(1)}" cy="${Y(x.values[last] as number).toFixed(1)}" r="3.5" fill="${x.color}" stroke="#FBF6EA" stroke-width="1.5"/>` : ''}`;
    }).join('');
    const data = JSON.stringify({ r: labels, s: series.map((x) => ({ n: x.name, v: x.values, c: x.color })), u: unit ?? '', x0: E, x1: W - D, W, k: digits ?? 0 }).replace(/'/g, '&#39;');
    const lastOf = (x: Series) => { const u = x.values.filter((v): v is number => v !== null); return u.length ? (u[u.length - 1] as number) : 0; };
    return `<figure class="graf" data-graf='${data}'><figcaption class="graf-leg">${series.map((x) => `<span><i style="background:${x.color}"></i>${x.name} <b>${x.label ?? fv(lastOf(x))}</b></span>`).join('')}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary ?? '')}">${grid}<text x="${E}" y="${H - 5}" class="gr-t">${labels[0] ?? ''}</text><text x="${W - D}" y="${H - 5}" text-anchor="end" class="gr-t">${labels[n - 1] ?? ''}</text>${lines}<line class="gr-c" x1="0" x2="0" y1="${Tp}" y2="${H - B}" style="display:none"/></svg><p class="graf-ler"></p></figure>`;
  },
  /** Stacked columns, one per season. */
  columns: ({ parts, labels, summary }: { parts: { name: string; values: number[]; color: string }[]; labels: string[]; summary?: string }) => {
    const W = 340, H = 112, E = 34, D = 6, Tp = 8, B = 20, n = labels.length;
    const tot = labels.map((_, i) => parts.reduce((x, p) => x + (p.values[i] ?? 0), 0)), step = axisStep(Math.max(1, ...tot)), top = Math.max(step, Math.ceil(Math.max(1, ...tot) / step) * step);
    const wd = Math.min(26, ((W - E - D) / n) * 0.62), X = (i: number) => E + ((i + 0.5) / n) * (W - E - D), Y = (v: number) => Tp + (1 - v / top) * (H - Tp - B);
    const grid = [0, 0.5, 1].map((f) => { const v = top * f, y = Y(v); return `<line x1="${E}" x2="${W - D}" y1="${y}" y2="${y}" class="gr-g"/><text x="${E - 4}" y="${y + 3.5}" text-anchor="end" class="gr-t">${fmt(v)}</text>`; }).join('');
    const cols = labels.map((_, i) => { let acc = 0; return parts.map((p) => { const v = p.values[i] ?? 0; if (v <= 0) return ''; const y1 = Y(acc), y2 = Y(acc + v); acc += v; return `<rect x="${(X(i) - wd / 2).toFixed(1)}" y="${(y2 + 0.6).toFixed(1)}" width="${wd.toFixed(1)}" height="${Math.max(0.5, y1 - y2 - 1.2).toFixed(1)}" rx="1.5" fill="${p.color}"><title>${labels[i]}: ${p.name} ${fmt(v)}</title></rect>`; }).join(''); }).join('');
    return `<figure class="graf"><figcaption class="graf-leg">${parts.map((p) => `<span><i style="background:${p.color}"></i>${p.name} <b>${fmt(p.values[n - 1] ?? 0)}</b></span>`).join('')}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary ?? '')}">${grid}<text x="${E}" y="${H - 5}" class="gr-t">${labels[0] ?? ''}</text>${n > 1 ? `<text x="${W - D}" y="${H - 5}" text-anchor="end" class="gr-t">${labels[n - 1]}</text>` : ''}${cols}</svg></figure>`;
  },
  /** Bars to both sides: what rose to the right, what fell to the left. */
  diverging: (items: { name: string; sub: string; v: number; alert?: boolean }[]) => {
    const mx = Math.max(1, ...items.map((x) => Math.abs(x.v)));
    return `<figure class="graf div">${items.map((x) => `<div class="div-l"><div class="div-n"><b>${x.name}</b><small>${x.sub}</small></div><div class="div-b"><span class="div-m"></span><i class="${x.v >= 0 ? 'mais' : 'menos'}${x.alert ? ' alerta' : ''}" style="width:${Math.max(2, (Math.abs(x.v) / mx) * 50).toFixed(1)}%"></i></div><b class="div-v ${x.v >= 0 ? 'mais' : 'menos'}">${signed(x.v)}</b></div>`).join('')}</figure>`;
  },
  pie: ({ parts, centre, centreSub, unit }: { parts: { name: string; value: number; color: string }[]; centre: string; centreSub?: string; unit?: string }) => {
    const tot = parts.reduce((x, q) => x + q.value, 0) || 1, R = 36, C0 = 2 * Math.PI * R;
    let ac = 0;
    const arcs = parts.filter((q) => q.value > 0).map((q) => { const f = q.value / tot, len = Math.max(0.5, f * C0 - 1.6); const a = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${q.color}" stroke-width="15" stroke-dasharray="${len.toFixed(2)} ${(C0 - len).toFixed(2)}" stroke-dashoffset="${(-ac * C0 + C0 / 4).toFixed(2)}"><title>${q.name}: ${Math.round(f * 100)}%</title></circle>`; ac += f; return a; }).join('');
    return `<div class="pizza"><svg viewBox="0 0 100 100" role="img">${arcs}<text x="50" y="50" text-anchor="middle" class="pz-c">${centre}</text><text x="50" y="62" text-anchor="middle" class="pz-s">${centreSub ?? ''}</text></svg><ul>${parts.filter((q) => q.value > 0).map((q) => `<li><i style="background:${q.color}"></i><span>${q.name}</span><b>${Math.round((q.value / tot) * 100)}%</b><small>${fmt(q.value)}${unit ? ` ${unit}` : ''}</small></li>`).join('')}</ul></div>`;
  },
  /** Four marks: when in the year it happens, the report's season highlighted. */
  seasons: (vals: number[], current: number) => { const mx = Math.max(1, ...vals); return `<span class="est4">${vals.map((v, i) => `<span class="${i === current ? 'hoje' : ''}"><i style="height:${v > 0.5 ? Math.max(14, (v / mx) * 100) : 0}%"></i><b>${T(`season.${i}`)[0]}</b></span>`).join('')}</span>`; },
  /** A bar growing one way, with value and verdict. */
  barValue: ({ title, sub, value, f, color, right, attrs }: { title: string; sub?: string; value: string; f: number; color: string; right?: [string, string?]; attrs?: string }) => `<button type="button" class="bval" ${attrs ?? ''}><span class="bval-t"><b>${title}</b><span class="${right?.[1] ? `dir-${right[1]}` : ''}">${right ? right[0] : ''}</span></span><span class="bval-b"><i style="width:${Math.max(2, Math.min(1, f) * 100)}%;background:${color}"></i></span><span class="bval-s"><small>${sub ?? ''}</small><small>${value}</small></span></button>`,
  /** A button that leads to an action (the same targets as the advice). */
  go: (txt: string, action: unknown, kind = '') => `<button type="button" class="${kind}" data-acao='${esc(JSON.stringify(action))}'>${txt}</button>`,
  /** What a bottleneck is, where it comes from, how to improve it. */
  explain: ({ what, blocks, fix, fixTitle }: { what?: string; blocks?: [string, string[]][]; fix?: (string | { text: string; action: unknown })[]; fixTitle?: string }) => `<div class="explica">${what ? `<h4>${T('ui.kit.what')}</h4><p>${what}</p>` : ''}${(blocks ?? []).filter((b) => b[1].length).map(([t, ls]) => `<h4>${t}</h4>${K.rows(ls)}`).join('')}${fix?.length ? `<h4>${fixTitle ?? T('ui.kit.improve')}</h4><div class="acoes">${fix.map((m) => (typeof m === 'string' ? `<p>${m}</p>` : K.go(m.text, m.action))).join('')}</div>` : ''}</div>`,
};

// ---- the bottom sheet (the prototype's "folha")

export const sheet = (): HTMLElement => $('folha');
let onSheetClose: () => void = () => {};
export const setSheetClose = (f: () => void): void => { onSheetClose = f; };
export function sheetWith(title: string, sub: string, body: string, info?: string): HTMLElement {
  const f = sheet();
  f.className = 'folhinha';
  f.innerHTML = `<div class="cabeca"><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${info ? K.info(info) : ''}<button type="button" class="x" id="fechar" aria-label="${esc(T('ui.close'))}">${X_SVG}</button></div>${body}`;
  $('fechar').onclick = () => onSheetClose();
  return f;
}

// ---- a short line over the map

let timer: ReturnType<typeof setTimeout> | undefined;
export function hint(txt: string, ms?: number): void {
  const d = $('dica');
  d.textContent = txt;
  clearTimeout(timer);
  if (ms) timer = setTimeout(() => { d.textContent = ''; }, ms);
}

// ---- the popup over everything: explanations, confirmations

export function popup(title: string, text: string, extra = ''): HTMLElement {
  const p = $('infoPop');
  p.innerHTML = `<div><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}${extra}</div>`;
  p.hidden = false;
  return p;
}
export const closePopup = (): void => { $('infoPop').hidden = true; };
/** Lists what an action will do and asks before doing it. */
export function confirm(title: string, lines: string[], yes: string, act: () => void, danger = false): void {
  const p = popup(title, '', `${lines.length ? K.rows(lines) : ''}${K.actions([{ id: 'popNo', text: T('ui.cancel') }, { id: 'popYes', kind: danger ? 'per' : 'pri', text: yes }])}`);
  (p.querySelector('#popNo') as HTMLElement).onclick = closePopup;
  (p.querySelector('#popYes') as HTMLElement).onclick = () => { closePopup(); act(); };
}
