// One robot run with a balance variant applied to the data, as a JSON line: for measuring a change.
//   npx tsx src/experiment.ts <variant> <seed> [greedy|patient]
// Variants change the settlement milestone over the game's balance ($ 160 grant, 10% of trade): base;
// share10; grant160 / grant200; share10grant; instalments (lot instalments back); instalmentsGrant160.
// They were measured against the old balance ($ 120, no share); see docs/PORTING.md.
import { MILESTONES } from '@assunguy/data';
import { RULES } from '@assunguy/sim';
import { play } from './bot.js';

const [variant = 'base', seed = '1869', policy = 'greedy'] = process.argv.slice(2);
const M0 = MILESTONES[0] as { grant: number; shareOfTrade: number };
if (variant === 'share10' || variant === 'share10grant') M0.shareOfTrade = 0.1;
if (variant === 'grant160' || variant === 'share10grant') M0.grant = 160;
if (variant === 'grant200') M0.grant = 200;
if (variant.startsWith('instalments')) RULES.installments = true;
if (variant === 'instalmentsGrant160') M0.grant = 160;
const r = play(Number(seed), { seasons: 60, policy: policy as 'greedy' | 'patient' });
const at = (t: number) => r.seasons.find((x) => x.t === t), cash = r.seasons.map((x) => x.cash).sort((a, b) => a - b);
console.log(JSON.stringify({ variant, seed, policy, ended: r.ended, parish: r.seasons.find((x) => x.milestone >= 1)?.t ?? null, families44: at(44)?.families, idle44: at(44)?.idle, cashMedian: cash[cash.length >> 1], last: r.seasons.at(-1)?.t }));
