# Deckbuilding Framework

The evaluation baseline every list gets graded against. Deviations are
allowed (±2 per quota) but must be noted and justified in the deck's
working notes.

## Role quotas (per 100 cards)

| Role | Target | Why |
|------|--------|-----|
| Lands | 36–38 | Below this, cheap-spell decks still miss drops; above it, you flood |
| Ramp | 8–10 | Commander tax + double-spelling turns |
| Card draw / advantage | 10+ | The #1 killer of casual decks is running dry on turn 7 |
| Targeted removal + counters | 8–10 | Coverage across timing profiles: before it resolves, after it resolves, board-wide |
| Board wipes | 2–3 | Reset button when behind |
| Wincons | ≥2 that survive commander removal | Resilience: the deck must win through the command zone being answered |

Everything left over is the synergy/theme budget.

## Principles

**Theme tax.** An on-theme card that underperforms is a tax on the deck's
consistency. Pay the tax only where theme and function overlap — a tribal
card that would make the cut on rate alone costs nothing; a vanilla
flavor pick costs a real slot. Rank every theme card explicitly:
earns-its-slot / marginal / pure tax. Pure-tax cards are the first cuts.

**One sub-theme per deck.** Competing packages (e.g., goad AND clones)
dilute both. Every card should advance the same core gameplan.

**Fuel vs. payoff.** Engine decks fail by stacking payoffs without the
cheap spells and refills to feed them. Count both sides: payoffs that
reward an action vs. cards that perform the action cheaply. Payoff-heavy
lists stall with impressive boards and empty hands.

**Multiplicative evaluation.** In engine decks, evaluate additions by
what they multiply, not what they add — trigger doublers and cost
reducers scale with everything else in play.

**Wincon diversity.** Spread win conditions across zones and threat types
(combat, burn, combo) so one form of interaction can't stop all of them.

**Practical fun.** Target power: WotC Brackets 3–4. Track the deck's Game
Changer count against the current official list (it updates — verify,
don't recall) and disclose the real bracket in rule-zero conversations.

## Revision discipline

Every change ships as a reviewable diff: OUT list, IN list, and the
reasoning, recorded in a changelog. The decklist file stays importable at
all times; pulled cards remain as comments so history is visible in the
file itself.
