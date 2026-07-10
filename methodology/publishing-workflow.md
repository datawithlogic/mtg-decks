# Publishing Workflow

How a deck goes from a decklist to the interactive page.

## Architecture: static artifacts, no runtime magic

Analysis is expensive and episodic; viewing is cheap and constant — so
they're fully separated. All deck review, synergy analysis, and card
verification happens offline (in a Cowork project with Claude, against
working notes that stay private). The published output is pure static
files: a page from today renders identically in five years, costs nothing
per view, and has zero server dependencies.

```
repo root
├── index.html          # deck directory
├── style.css           # shared theme (one file, all decks)
├── viewer.js           # generic renderer (one file, all decks)
├── methodology/        # you are here
└── decks/
    └── <deck-slug>.html   # per-deck: JSON data + two includes
```

## The deck data model

Each deck page contains one JSON block; `viewer.js` renders everything
from it. Shape:

- `name / sub / revnote / hint` — header metadata
- `clusters[]` — `{k, label, blurb, how, ex, why}`: every synergy cluster
  teaches at three depths — rules mechanics, a concrete example line, and
  the transferable deckbuilding principle
- `groups[]` — functional groups (engine, fuel, interaction, big turns,
  wincons, ramp), each card as `{n, mv, tags, tip, ...flags}`; `tags` link
  cards to clusters and drive the relationship highlighting
- `pulled` — the current revision's cuts (builder view only)

Adding a deck = adding one JSON file + one index entry. No code changes.

## Card data: batched, cached, client-side

- Authoring time: card texts are verified against Scryfall's
  `POST /cards/collection` endpoint — up to 75 cards per request, never
  one-off queries.
- View time: the page makes one batched collection call for type lines
  (localStorage, 7-day TTL); card images/prices fetch lazily per modal
  open and cache in-session. Scryfall's API allows this cross-origin, so
  no backend is needed.

## Views

- **Share view (default):** the clean, as-is deck. QR stickers on
  physical deckboxes encode the plain page URL, so friends land here.
- **Builder view (`?view=builder`):** revision overlay — diff markers
  (＋ added / － pulled), the pulled-cards tray, and revision notes.

## Cache discipline

GitHub Pages caches assets for ~10 minutes. Asset includes carry a
version stamp (`viewer.js?v=YYYYMMDDx`) bumped on every publish, so
returning visitors get fresh code as soon as the HTML expires — no stale
UI during iteration.
