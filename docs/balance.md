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
walk past a store with no gateway in reach to one that exports.

The first run of these changes showed a limit that was already there: the parish comes with level 4, which asks
for 50 workers, and the robot kept the colony a few jobs short with 65 to 75 families idle (2 of 12 runs missed
the parish, against 1 of 12 before). The advisor now has a measured jobs advice for that case (`levelWorkers`): when
the next level lacks only workers, the cheapest job that still pays (at least 8% of its cost a year), above other
investments for the level that brings a title; the robot builds two at a time, as a player would.

Six seeds, both policies, 72 seasons (parish season, waste at 72):

| Seed | Before: greedy / patient | After: greedy / patient |
|---|---|---|
| 1869 | 50, 37% / 52, 24% | 37, 28% / 37, 11% |
| 4242 | 50, 23% / 50, 19% | 38, 19% / 38, 48% |
| 777 | 49, 25% / 51, 24% | 39, 16% / 38, 37% |
| 7 | 47, 12% / 46, 17% | 37, 38% / 38, 29% |
| 31 | 53, 33% / not reached, 30% | 39, 27% / 40, 16% |
| 2024 | 41, 27% / 47, 31% | 37, 23% / 41, 41% |

Parish reached in 12 of 12 runs (11 before), all before the deadline at 44 (before, most needed the extra time).
Income at 72 averages $ 8.010 a year (was $ 7.250); waste, 28% (was 25%), higher in some patient runs.

Over 130 seasons (`pnpm balance`), the village is still reached in 1 of 6 runs (seed 4242, patient, season 79, was
99); the rest end at its deadline, now earlier because the parish comes earlier. The village (180 families, four
lands, more services) is the next thing to review.
