# From Decklist to Deck Map — the AI pipeline

The concrete process: what the AI actually does, stage by stage, to turn
a raw decklist into the interactive page. The other docs in this folder
are the rulebooks each stage consults; this is the assembly line.

## Input

A decklist — a ManaBox/Moxfield URL or a plain "1 Card Name" text file.
That's the only required input.

## Stage 1 — Verify every card (no memory allowed)

Every card name is sent to Scryfall's batch endpoint
(`POST /cards/collection`, 75 cards per call) and the **exact oracle text**
comes back. All downstream analysis works from that text, never from the
AI's recollection — MTG has 27,000+ cards, reprints change wording, and
new sets ship constantly. A cluster explanation that misreads a trigger
("whenever you cast" vs. magecraft's "cast or copy") teaches the reader
something false, so verification is stage one, not an afterthought.

## Stage 2 — Grade the skeleton

The list is audited against the role quotas in
[deckbuilding-framework.md](deckbuilding-framework.md): lands, ramp,
draw, removal coverage, wipes, resilient wincons. Output is a table of
have vs. target with verdicts — this is where holes get found (e.g.,
"counterspells but zero answers to a resolved permanent"). Theme cards
get ranked earns-its-slot / marginal / pure-tax.

## Stage 3 — Find the synergy clusters

This is the heart of the method. Starting from the commander's mechanic,
the AI traces how cards actually interact under the rules:

1. **Read the commander's trigger precisely.** What does it count? What
   does it copy? What's optional? Every cluster radiates from here.
2. **Group by shared loop, not shared keyword.** A cluster is a set of
   cards that participate in the *same repeatable sequence* — e.g. "every
   noncreature spell untaps my Otters, so tap-abilities become engines."
   Cards that merely look similar don't cluster; cards that form a loop do.
3. **Separate trigger classes.** "Whenever you cast" ≠ magecraft ≠
   activated ability. Cards land in different clusters when their trigger
   class changes what feeds them (copies feed magecraft but not
   cast-triggers — that distinction becomes a teaching point).
4. **Cap at 6–8 clusters** (9 hard max, per the
   [UX standard](deck-map-ux.md)); merge the two most related rather than
   exceed it.

Each cluster is then written at three depths — *How it works* (rules
mechanics), *Example line* (a concrete turn you can picture), and
*Deckbuilding principle* (the transferable lesson) — so the map teaches
when and why cards matter, not just that they're related.

## Stage 4 — Tag and annotate every card

Each card gets: one **functional group** (engine / fuel / interaction /
big turns / wincons / ramp — by the role it plays, not its card type),
**tags** linking it to every cluster it participates in (these drive the
relationship highlighting), and a one-line **tip** describing its role in
*this* deck — written from the verified oracle text.

## Stage 5 — Emit data, not markup

Everything above is serialized into one JSON block (schema in
[publishing-workflow.md](publishing-workflow.md)) inside a small HTML
file. The shared `viewer.js` renders it — the AI never hand-writes page
markup, so every deck gets identical UX and improvements to the viewer
retroactively upgrade every deck. Revisions are diffed against the prior
list: adds get ＋ markers, cuts move to the pulled tray, the cache version
bumps, and the page is pushed.

## Worked example: one card through the pipeline

**Storm-Kiln Artist** in an Alania (Izzet spellslinger) deck:

- *Stage 1:* oracle text confirms **magecraft** — "whenever you cast or
  **copy** an instant or sorcery spell, create a Treasure token."
- *Stage 3:* the copy clause matters — the commander copies spells, so
  Storm-Kiln triggers on copies too, unlike Guttersnipe's cast-only
  trigger. It joins the *storm turn* cluster (treasures fund chains) and
  the *Muddle myriad* cluster (it's a copyable attack body).
- *Stage 4:* group = "Cast-trigger payoffs"; tags = `myriad bigturn`;
  tip = "Magecraft: Treasure per cast/copy — pays for the next spell."
- *Stage 5:* one JSON line:

```json
{"n":"Storm-Kiln Artist","mv":4,"tags":"myriad bigturn",
 "tip":"Magecraft: Treasure per cast/copy — pays for the next spell"}
```

On the page, that line becomes: a chip that lights up with segmented
borders when you select a related card, a hover box showing its type and
clusters, and a modal with its image, prices, role, and tappable
relationships.

## Division of labor

The human owns direction and taste: theme, power target, and the verdict
on every proposed change (all edits ship as reviewable diffs). The AI
owns verification, consistency, and applying the written standards — the
point of writing the rules down is that deck #10 gets exactly the same
rigor as deck #1.
