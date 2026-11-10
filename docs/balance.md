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
