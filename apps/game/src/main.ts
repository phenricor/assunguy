import './legacy/prototype.css';
import { SHEETS } from './assets';
import { hooks, api, vars, show } from './view';
import * as store from './store';

hooks.carregaImg = (src: string, keep: (i: HTMLImageElement) => void) => new Promise<void>((ok, fail) => {
  const url = SHEETS[src];
  if (!url) { fail(new Error(src)); return; }
  const i = new Image(); i.onload = () => { keep(i); ok(); }; i.onerror = fail; i.src = url;
});
hooks.menuAberto = () => false;
hooks.sorteio = () => Math.random();
hooks.CONS = () => store.session().meta.advisor;
hooks.NOMEC = () => store.session().meta.colony;

const g = store.start({ colony: 'Colônia do Assunguy', advisor: 'Inácio', seed: 1869 });
show(g.s, g.w, store.ratings());
await api.garanteVista(0);
await hooks.carregaImg('anim.png', (i: HTMLImageElement) => { vars.animAtlas = i; });
api.ajusta();
api.centra(22, 53);
api.refazPescadores();
for (let i = 0; i < 30; i++) api.atualizaGente(0.05);
requestAnimationFrame(api.laco);
(window as any).dbg = { api, vars, store };
