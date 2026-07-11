# Deck-Map UX Standards — Color & Border Methodology

Authoritative reference for how deck-map colors and borders are chosen.
Applied mechanically per deck — colors are never re-discussed. viewer.js implements this.

## Cluster color palette — derivation & rules

Base: **Okabe-Ito palette** (Color Universal Design; the accepted standard
for categorical color, distinguishable under all three common types of
color vision deficiency), adapted for our dark background:

- Dropped black (invisible on #141821); blue #0072B2 brightened to
  #4A90D9 to clear the 3:1 non-text contrast floor against panel
  backgrounds (WCAG 1.4.11).
- Appended violet + neutral grey as slots 8–9 (grey doubles as a natural
  fit for "graveyard/neutral" style clusters).

**PALETTE (assign in this order, by cluster order in the deck JSON):**

| # | hex | name |
|---|---------|------------|
| 1 | #56B4E9 | sky blue |
| 2 | #E69F00 | orange |
| 3 | #CC79A7 | mauve |
| 4 | #009E73 | green-teal |
| 5 | #F0E442 | yellow |
| 6 | #4A90D9 | blue |
| 7 | #D55E00 | vermillion |
| 8 | #9B7FE8 | violet |
| 9 | #BDBDBD | grey |

Rules:

1. **Cluster count: target 6–8, hard cap 9.** Research consensus: beyond
   8 categorical colors, reliable discrimination collapses. If a deck
   wants 10+ clusters, merge the two most related instead.
2. Order clusters in the JSON so *conceptually related* clusters sit far
   apart in palette order (the palette alternates hue families for this).
3. Optional `color` field on a cluster overrides palette order — use ONLY
   for strong semantic fits (e.g., vermillion for a damage cluster), and
   never duplicate an already-assigned hue.
4. **Reserved semantics, never assigned to clusters:** gold #D4A94F =
   selection + commander; green #4FBF78 = added this rev; red #D9534F =
   pulled this rev. Palette entries 4 and 7 approach these hues, which is
   tolerated because add/pull/select are ALSO encoded by symbol (＋ / －,
   strikethrough, ring vs. border) — see redundancy rule below.
5. **Never color-only (WCAG 1.4.1):** every color-coded state must carry
   a second channel — relationship highlighting pairs color with dimming
   (non-related chips drop to 16% opacity); diff markers pair with ＋/－
   symbols and strikethrough; selection is a ring, not a border color.

## Border & emphasis rules

Principle: borders convey *state*, not decoration. At rest the map is
near-monochrome; color appears only during active exploration. This is
the busy-ness guard — salience is spent only where attention should go.

- **1px neutral (#303a52)** — resting chip structure. Never colored at rest.
- **Lit = 2px colored border + global dim** — relationship highlight. The
  signal is hue + the 16%-opacity figure-ground drop. 2px because
  multi-cluster segments (below) are imperceptible at 1px; box-sizing is
  border-box so no layout shift.
- **Multi-cluster membership: segmented borders.** When a lit chip shares
  2+ clusters with the selection, its border is a conic-gradient of equal
  arcs (50/50 for two, thirds for three), capped at 4 segments for
  legibility. Implemented via padding-box/border-box gradient so the
  border radius is preserved. Single shared cluster = solid color.
- **Info box contents (hover tip / touch bar):** card type line + mana
  cost (so users know WHAT it is), role blurb, colored cluster badges.
  Type data comes from ONE batched Scryfall /cards/collection call per
  deck at load, localStorage-cached 7 days — never per-card requests,
  never hand-maintained in the JSON.
- **2px gold ring (box-shadow)** — current selection. A ring, not a
  border, so it composes with cluster-colored borders and the otter edge.
- **4px colored left edge** — legend/key affordance only (Gestalt
  connectedness: legend edge ↔ chip border share the hue). One-sided so
  legend cards don't read as alert boxes.
- **3:1 minimum contrast** for any border/edge that conveys meaning,
  against its adjacent background (WCAG 1.4.11 non-text contrast). All
  palette entries clear this on #1C2230/#232B3D panels.

## Mana at a glance (per deck, auto-rendered)

A full-width card at the top of the groups grid: a stacked pip-demand bar
(colored mana symbols across all maindeck casting costs, hybrids split
fractionally, computed from the Scryfall prefetch — never hand-counted)
plus per-color counts/percentages as redundant text, plus an authored
`manaNote` in the deck JSON: 1–3 plain-language sentences telling a newer
player which colors to prioritize getting on board and any exceptions
(e.g., one steep multi-pip bomb). WUBRG segments use MTG's semantic card
colors (dark-bg tuned: W #E8DFB8, U #4AA3DF, B #9B7FB8, R #E05C4B,
G #4FBF78) — a separate encoding domain from the cluster palette; the two
never mix meanings.

## Full mana base + sleeve check (required per deck)

- **No opaque "Lands ×N" chips.** Every deck JSON carries a `lands`
  section (`{n, count?, tip?}` — `count` for basics) listing the complete
  mana base, rendered as a collapsed expander in the map so it informs
  without adding resting noise. Utility lands with synergy stay in their
  synergy groups; the lands desc says so. Groups + lands MUST sum to
  exactly the deck's card count — verify programmatically on regeneration.
- **Sleeve-check view** (`☑` button, or `?sleeve=1`): a physical-assembly
  checklist — sections by card type (derived from the Scryfall prefetch,
  never hand-maintained), alphabetical within, quantity shown, checkbox
  per line, progress counter, reset button. Check state persists in
  localStorage per deck slug. Layout is list-density, not chip-density:
  its job is verification, not exploration.

## Interaction budget (keep it actionable, not busy)

- Any state reachable in ≤2 taps; any state escapable by tapping empty
  space or ✕.
- One cluster deep-dive open at a time, inserted directly below its
  cluster, in its color.
- Modal "Related in this deck" capped at 10 chips, each border-colored by
  the cluster it *shares with the source card*.
- Colors at rest: only commander gold, diff green/red (builder view), and
  legend left-edges. Everything else activates on demand.
