// Starts the game: the prototype's stylesheet and renderer, the interface, the start menu.
import './render/render.css';
import './ui/extra.css';
import * as sim from '@assunguy/sim';
import { defineEvent, type QueuedEvent } from '@assunguy/sim';
import { SHEETS } from './assets';
import { hooks, api, vars, show } from './view';
import * as store from './store';
import { setErrorSink } from './store';
import { hint } from './ui/kit';
import { T, has, onLocale } from './i18n';
import { bar, guide, nextEvent, passSeason, refresh, wire, cancel } from './ui/app';
import { chooseBuild, openBuildList, previewAt, previewMove, streetTap, railTap, openStreet } from './ui/build';
import { openBuilding, openLand } from './ui/select';
import { openReport, openReports } from './ui/report';
import { openAdvisor, runAction } from './ui/advisor';
import { openColony, openGovernment, openTransport, openLevel, openDistrict } from './ui/screens';
import { openLayers } from './ui/layers';
import { openMenu, openSettings, menuOpen, startMenu } from './ui/menu';

hooks.carregaImg = (src: string, keep: (i: HTMLImageElement) => void) => new Promise<void>((ok, fail) => {
  const url = SHEETS[src];
  if (!url) { fail(new Error(src)); return; }
  const i = new Image(); i.onload = () => { keep(i); ok(); }; i.onerror = fail; i.src = url;
});
hooks.sorteio = () => Math.random();
hooks.SHEETS = SHEETS;
hooks.CONS = () => (store.hasGame() ? store.session().meta.advisor : 'Inácio');
hooks.NOMEC = () => (store.hasGame() ? store.session().meta.colony : 'Assunguy');
hooks.menuAberto = () => menuOpen();
hooks.saying = (i: number, pt: string) => (has(`ui.map.saying.${i}`) ? T(`ui.map.saying.${i}`) : pt);
hooks.word = (k: string, pt: string) => (has(`ui.map.${k}`) ? T(`ui.map.${k}`) : pt);
/** After a language change: redraw what carries words (the map's cartouche and sayings, the bars). */
hooks.relabel = () => {
  vars.cartelaTitulo = null; vars.escalaLegua = null; api.limpaPedacos?.(); vars.chaoSujo = true;
  if (store.hasGame()) { refresh(); cancel(); }
};
Object.assign(hooks, {
  chooseBuild, openBuildList, previewAt, previewMove, streetTap, railTap, openStreet, openBuilding, openLand,
  defineEvent: (ev: QueuedEvent) => defineEvent(store.session().s, ev),
  openReport, openReports, openAdvisor, runAction, openColony, openGovernment, openTransport, openLevel, openDistrict,
  openLayers, abreCamadas: openLayers, openMenu, openSettings, abreMenu: openSettings, guide, passSeason,
});
setErrorSink((msg) => { api.Sons.toca('erro', 300); hint(msg, 2600); });
wire();
onLocale(() => hooks.relabel());

/** Puts a session on the map: view, camera, people, and the first event. */
export function enter(): void {
  const g = store.session();
  show(g.s, g.w, store.ratings());
  api.limpaPedacos?.();
  api.ajusta();
  const seat = Object.entries(g.s.map.buildings).find(([, t]) => t === 'directorate' || t === 'chapel')?.[0] ?? '22,51';
  const [a, b] = seat.split(',').map(Number) as [number, number];
  api.centra(a, b + 2);
  vars.gente = []; vars.tropas = []; vars.expedicoes = [];
  refresh();
  for (let i = 0; i < 30; i++) api.atualizaGente(0.05);
  cancel(); bar();
  nextEvent();
}
hooks.enter = enter;

await api.garanteVista(0);
await hooks.carregaImg('anim.png', (i: HTMLImageElement) => { vars.animAtlas = i; });
api.ajusta();
['click', 'touchend', 'pointerup', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { api.Musica.retoma(); api.Sons.destrava(); }, true));
startMenu();
requestAnimationFrame(api.laco);
(window as unknown as { dbg: unknown }).dbg = { api, vars, store, hooks, sim };
