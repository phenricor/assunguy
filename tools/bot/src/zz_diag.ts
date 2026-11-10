import { play } from './bot.js';
const r = play(1869, { seasons: 60 });
const keys = ['taxes', 'grant', 'share', 'tariffs', 'upkeep', 'wages', 'relief', 'works', 'greatWorks', 'agent', 'fleet', 'arrivals'] as const;
for (const [a, b] of [[0, 8], [8, 16], [16, 32], [32, 60]]) {
  const xs = r.seasons.slice(a, b), sum = (k: string) => xs.reduce((t, x) => t + ((x.purse as any)[k] ?? 0), 0);
  console.log(`seasons ${a}-${b}:`, keys.map((k) => `${k} ${Math.round(sum(k) / Math.max(1, xs.length))}`).join(', '), '| fam', xs.at(-1)?.families, 'idle', xs.at(-1)?.idle);
}
