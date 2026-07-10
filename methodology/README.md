# Methodology

How these deck maps get built. The short version: the decks and the
analysis are developed in a [Cowork](https://claude.com) project with
Claude — deck review, synergy-cluster analysis, card verification against
Scryfall, and UX standards all live as written rules that get applied
mechanically, so every deck ships the same way without re-deciding
anything. This folder is the public copy of those rules.

## Contents

- **[decklist-to-deck-map.md](decklist-to-deck-map.md)** — **start here**:
  the pipeline. How the AI takes a raw decklist and produces one of these
  pages, stage by stage, with a worked example.
- **[deckbuilding-framework.md](deckbuilding-framework.md)** — how decks
  are evaluated: role quotas, theme tax, fuel vs. payoff, bracket targets.
- **[deck-map-ux.md](deck-map-ux.md)** — the visual/UX standard: cluster
  color methodology (Okabe-Ito, colorblind-safe), border semantics,
  interaction budget, accessibility floors.
- **[publishing-workflow.md](publishing-workflow.md)** — how a deck goes
  from decklist to the interactive page you're looking at: data model,
  batched Scryfall lookups, builder vs. share views, cache versioning.

## The system in one paragraph

Each deck is a single HTML file holding a JSON block (cards, functional
groups, synergy clusters with teaching notes) rendered by one shared
`viewer.js`. Nothing here runs on a server — GitHub Pages serves static
files, and the viewer fetches card images/prices from Scryfall client-side
with caching. Synergy clusters aren't just lists: each one explains how
the interaction works under the rules, gives a concrete example line, and
names the transferable deckbuilding principle behind it. QR stickers on
the physical deckboxes point at these pages.
