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

## Rebalance on districts (November 2026)

Aim: a full game of 2 to 3 hours (about 240 seasons), unemployment around 25% at most, and a city that fills its
map. Changes, with the prototype's values in `packages/sim/test/fixtures/prototype-rules.json` (the golden tests
run on them through `test/prototypeRules.ts`):

- Homes hold 1, 2, 3 and 4 families (hut, house, whitewashed house, townhouse; they held 2, 4, 5 and 6). The
  colony starts in four houses with eight families (`BALANCE.smallHomes`).
- 18 levels: hamlet 1 to 4, parish 5 to 8, village 9 to 13, town 14 to 18. Unlocks are spread over them; the
  council moves to level 7 so taxes come before the village's costs. Levels 8, 12, 16 and 18 ask for 2, 3, 4 and 5
  districts; 10, 13 and 17 for at most 30%, 25% and 25% of families without work.
- Milestones count families at work (`BALANCE.milestoneWorkers`): parish 44 in 40 seasons, village 90 in 56,
  town 190 in 72.
- Advisor: it aims at the jobs the next level really asks for, suggests homes when a level lacks families for its
  jobs (`levelFamilies`), suggests a tithe a point above the milestone's satisfaction (`BALANCE.titheSpare`, was 3),
  and brings the road forward from two levels before the town.

Robot, patient policy, up to 280 seasons (season each level was reached; the game starts at 12):

| Seed | Parish (5) | Village (9) | Level 13 | Town (14) | Level 15 | Mean idle |
|---|---|---|---|---|---|---|
| 1869 | 36 | 79 | 151 | missed (165) | - | 22% |
| 4242 | 37 | 79 | 111 | 165 (extra time) | 166 | 18% |
| 777 | 36 | 75 | 118 | 126 | 143 | 18% |

Before (twelve levels, big homes, milestones counting every family): parish at 37 to 41 when reached, the village
reached once (79), idle 30% to 40%. Greedy robots still miss the village: they never save for the market.

The town needs the road to Curitiba (lands south, then a street to the edge); the advisor now asks for it from two
levels before, and prefers lands on its way.

Taxes (later the same day). The advisor suggested only the tithe, held satisfaction at 61 after the town and then
took every tax off a colony in the red; the patient robot skipped taxes while saving for something dear. Now the
export duty is suggested too, the floor after the town is 50, a colony in the red is not told to lower taxes, and
the robot takes advice that costs nothing. Seed 777 after the town: tithe and duty at 20%, cash from $ 1,800 to
$ 6,000 and $ 1,500 to $ 2,000 a season over upkeep of $ 1,100 to $ 1,600 (it went below zero within 4 seasons before).

| Seed | Village (9) | Town (14) | Level 15 | End |
|---|---|---|---|---|
| 1869 | 74 | missed (the road was not done by 151) | - | 156 |
| 4242 | 76 | 138 | 139 | race lost at 183 |
| 777 | 75 | 126 | 138 | race lost at 172 |

The race is now lost to the rivals, not the purse: about 20 seasons after the town the rivals' advances take the
colony's markets (competitiveness under 80%), income falls by a third, and families leave on the race's departure
rule (240 to 64 in 12 seasons) until the cash goes below zero. The robot does not build rails or trains, so this
says little about a player; but the departures are steep, and worth a look when the race is balanced.

The late levels are set from the player's save (year 28, season 121: 514 families in big homes, about 278 at
work, $ 30,000 a year), which on the new rules sits at level 14 and would need about twice the homes to reach 18.
