# Balance

## The robot player

`pnpm balance [seasons] [seed ...]` plays new games by following the advisor, with two policies: greedy
(takes the heaviest advice it can pay for) and patient (saves for heavier advice it cannot pay for yet).
The advisor never suggests opening streets, so the robot keeps streets ahead of the houses on its own.

Findings before the balance review (October 2026), three seeds (1869, 4242, 777), both policies:

- No run reached the parish: 46 to 52 families of 90 at the deadline (season 44); every run ended at 58.
- The purse was the bottleneck (median cash $ 67 to $ 93): the grant barely covers upkeep until taxes.
- Idle families stayed at 30% to 40%, so the advisor stopped asking for huts while jobs waited for cash.
- The advisor never asked for streets.

After the advisor's priorities changed (streets, the milestone first near the deadline, homes when behind on
families), with the same rules, 60 seasons, greedy (`src/experiment.ts`):

| Variant | Parish reached (season) | Families at 44 | Median cash |
|---|---|---|---|
| base | never (3 of 3) | 70 to 72 | $ 54 to $ 88 |
| grant $ 200 at the start | 57, 58, never | 72 to 83 | $ 184 to $ 237 |
| 10% of trade from the start | 52, never, never | 64 to 84 | $ 246 to $ 553 |
| 10% of trade and grant $ 160 | 47, 47, 51 | 88 to 92 | $ 262 to $ 315 |
| lot instalments back (`RULES.installments`) | never (3 of 3) | 71 to 82 | $ 104 to $ 201 |
| lot instalments and grant $ 160 | 49, 53, never | 69 to 88 | $ 210 to $ 349 |

The parish is due at 44, 48 with the extra time the province grants.

The last of these is now the game's balance: with it, `base` gives parish at 47, 47 and 51.


## After the game (November 2026, 130 seasons)

| Seed | Greedy: parish / village | Patient: parish / village |
|---|---|---|
| 1869 | 50 / not reached | 52 / not reached |
| 4242 | 50 / not reached | 50 / 99 (with extra time) |
| 777 | 49 / not reached | 51 / not reached |

The parish is on time. The village (180 families, 40 seasons after the parish) is mostly missed: the robot
reaches 165 to 175 families before the deadline. The fixes so far are in the advisor and the robot (street
lines from any free stretch, homes when families lag, the goal before new jobs near the deadline); the goal's
numbers are unchanged. Candidates if the village should be reachable by following the advisor: a 48-season
deadline, or 160 families.

## Transport review (1.0.0-beta.7, November 2026)

New collection points and gateways come with their first vehicle, mule trains cost $ 200 and carry 80, the trading
post, landing and waystation open at level 3, every transport advice is measured on the whole chain, and producers
walk past a store with no gateway in reach to one that exports. Six seeds, both policies, 72 seasons:

| Seed | Before: greedy / patient (parish, waste at 72) | After: greedy / patient |
|---|---|---|
| 1869 | 50, 37% / 52, 24% | not reached, 37% / 45, 8% |
| 4242 | 50, 23% / 50, 19% | 45, 21% / 43, 27% |
| 777 | 49, 25% / 51, 24% | 50, 25% / not reached, 5% |
| 7 | 47, 12% / 46, 17% | 47, 11% / 42, 23% |
| 31 | 53, 33% / not reached, 30% | 54, 22% / 41, 13% |
| 2024 | 41, 27% / 47, 31% | 43, 21% / 46, 10% |

Parish reached in 11 of 12 runs before and 10 of 12 after; when reached, a median of 50 seasons before and 45
after. Waste at season 72 averages 25% before and 19% after; income, $ 7.250 and $ 7.690 a year.

The two runs that miss the parish now both stall at level 3 with 65 to 75 families idle: the parish comes with
level 4, which asks for 50 workers, and the robot keeps the colony a few jobs short. Their waste is low (5% and
37%, the second with the pier full all the time), so the bottleneck is jobs, not transport. Worth its own review:
the level 4 worker requirement against the robot's job advice.
