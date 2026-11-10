// Balance report: the robot player on a few seeds, season by season, with the goals against their deadlines.
//   pnpm balance [seasons] [seed ...]
import { MILESTONES, type MilestoneDef } from '@assunguy/data';
import { play } from './bot.js';

const args = process.argv.slice(2).map(Number).filter((x) => !Number.isNaN(x));
const seasons = args[0] ?? 96, seeds = args.length > 1 ? args.slice(1) : [1869, 4242, 777];
for (const seed of seeds) for (const policy of ['greedy', 'patient'] as const) {
  const run = play(seed, { seasons, policy });
  console.log(`\nseed ${seed}, ${policy}: ${run.ended}, ${run.seasons.length} seasons, deadlines missed ${run.missed}`);
  console.log('   t lvl ms  due   cash  fam idle income sat  pier waste  actions');
  for (const x of run.seasons) if (x.t % 4 === 0 || x.actions.length) console.log(`${String(x.t).padStart(4)} ${String(x.level).padStart(3)} ${String(x.milestone).padStart(2)} ${String(x.deadlineLeft ?? '-').padStart(4)} ${String(x.cash).padStart(6)} ${String(x.families).padStart(4)} ${String(x.idle).padStart(4)} ${String(x.income).padStart(6)} ${String(x.satisfaction).padStart(3)} ${(x.gatewayFull * 100).toFixed(0).padStart(4)}% ${(x.waste * 100).toFixed(0).padStart(4)}%  ${x.actions.join(', ')}`);
  for (const m of [1, 2, 3]) { const at = run.seasons.find((x) => x.milestone >= m); console.log(`  ${(MILESTONES[m] as MilestoneDef).id}: ${at ? `season ${at.t}` : 'not reached'}`); }
}
