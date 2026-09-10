# The Stacks

A personal, interactive 3D virtual library. The shelves hold books I've actually
finished — as I read more, the library grows.

> "This is my library, and it grows as I read."

## Getting started

```bash
pnpm install
cp .env.example .env   # optional; the app runs without it
pnpm dev
```

(`npm install` works too — delete `pnpm-lock.yaml` first if you go that way.)

Then open the URL Vite prints (usually http://localhost:5173).

## What's here

This repository is a **scaffold**, not a finished app. The room, shelves, book
placement, search, persistence and suggestion box are all wired up end to end so
the project runs from the first commit — but everything is intentionally plain
and waiting to be built out against `docs/SPEC.md`.

- Click the canvas to look around, `W A S D` to walk, `Esc` to release the cursor.
- `+ Add book` searches Google Books (Open Library as a fallback) and shelves it.
- Click a book to open its panel; edit your rating, dates, thoughts and quote.
- Click the brass box on the stand to leave or read a suggestion.
- Everything persists to `localStorage` and reloads on refresh.
- Touch devices fall back to an accessible list view automatically.

## Layout

```
src/
├── components/          2D overlay UI
│   ├── ui/              primitives: Button, Panel, Field, StarRating, feedback
│   ├── books/           add-book flow, info panel, cover
│   ├── library/         HUD, stats, list-mode fallback
│   └── suggestions/     suggestion box panel
├── three/               everything WebGL — presentational only
│   ├── LibraryCanvas    the single <Canvas> and its performance settings
│   ├── LibraryScene     composes the room
│   ├── Room / Bookshelf / Book3D / Desk / SuggestionBox
│   ├── controls/        WASD + pointer lock
│   ├── lighting/        the room's light rig
│   └── materials/       shared materials, palette, cover-texture cache
├── services/
│   ├── books/           BookService + Google Books / Open Library providers
│   └── persistence/     Repository<T> + localStorage implementation
├── models/              Book, Suggestion, type guards, helpers
├── stores/              zustand: library, suggestions, UI
├── hooks/               search, bootstrap, pointer type, escape key
├── utils/               shelf layout, book dimensions, stats, cover fallback
└── data/                invented placeholder books for layout work
```

## Configuration

Copy `.env.example` to `.env`. Everything in it is optional:

| Variable                    | Purpose                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `VITE_GOOGLE_BOOKS_API_KEY` | Raises the rate limit. **Public** — use a referrer-restricted key only. |
| `VITE_BOOK_PROVIDER`        | `google` (default) or `openlibrary` — which provider is tried first.    |
| `VITE_STORAGE_NAMESPACE`    | Prefix for localStorage keys.                                           |

## Stack

React 19 · TypeScript · Vite · three.js · React Three Fiber · drei · Tailwind
CSS v4 · zustand · Vitest.

See `CLAUDE.md` for architecture rules and `docs/SPEC.md` for the product spec.
