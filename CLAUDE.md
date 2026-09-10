# The Stacks — working notes for Claude Code

A personal 3D virtual library. The full product spec lives in `docs/SPEC.md` —
read it before making architectural decisions. This file covers only how the
scaffold is arranged and the rules to keep to.

## Status

MVP complete. Every step of the spec's Definition of Done (section 21) is wired
end to end: enter the room, walk around it, search a real book, add it, watch it
appear on the shelf, click it, edit what you wrote, reload and find it there,
and use the suggestion box. Phase 5 polish is in — materials, props, entry and
hover animation, loading/empty/error states, collision, reduced motion and the
non-3D fallbacks.

Mobile is in as well: touch devices get the real room, driven by drag, tap and
pinch instead of pointer lock, plus a thumb-reachable HUD, bottom-sheet panels
and safe-area insets. See "Touch" below.

Phase 6 (future features, spec section 18) is deliberately untouched.

## Commands

| Command                       | What it does                     |
| ----------------------------- | -------------------------------- |
| `pnpm dev`                    | Vite dev server                  |
| `pnpm build`                  | `tsc -b` then a production build |
| `pnpm typecheck`              | Types only                       |
| `pnpm lint` / `pnpm lint:fix` | ESLint                           |
| `pnpm test`                   | Vitest                           |
| `pnpm format`                 | Prettier                         |

`@/` is an alias for `src/` (set in both `vite.config.ts` and `tsconfig.app.json`
— change both together).

## Architecture rules

These come from the spec's agent instructions. Do not quietly break them.

1. **3D rendering stays separate from data logic.** Components under `src/three/`
   are presentational: they take props and callbacks. `App.tsx` is the only
   place that reads stores and hands data to `LibraryScene`.
2. **Nothing outside `src/services/books/` knows a provider's response shape.**
   Providers normalise into `ExternalBook`; the app stores `Book`. Adding a
   provider = one new class implementing `BookProvider`, registered in
   `BookService`. No other file changes. `covers.ts` extends this to their
   CDNs — which host serves what, and which sends CORS headers — because that
   is provider knowledge too, and the 3D layer needs the answer.
3. **Persistence is behind `Repository<T>`.** `LocalStorageRepository` is the
   current implementation. Moving to Supabase/Postgres/an API means writing a
   new class and swapping two lines in `services/persistence/repositories.ts`.
4. **Shelf placement is computed, never hand-authored.** `utils/shelfLayout.ts`
   packs books left-to-right, wraps to the next shelf, then spills into a new
   bookcase. It is pure and deterministic — test it, don't eyeball it.
   So is the room: `utils/roomLayout.ts` decides where the bookcases and the
   furniture stand, and deepens the room when the walls fill up. Nothing in
   `src/three/` should carry a hand-typed coordinate for a piece of furniture —
   add it to the plan instead, so collision and rendering cannot drift apart.
5. **Book sizes are derived deterministically** from page count and a hash of
   the book id (`utils/bookDimensions.ts`), so a book never changes size
   between renders or reloads. Books stand COVER-OUT, so `width` is the cover
   and `depth` is the spine — a book eats about five times the shelf a
   spine-out one would, and a shelf holds roughly ten.
6. **Services return `Result<T>`, they do not throw.** See `utils/result.ts`.
   Every call site decides what the reader sees.
7. **No secrets in the client.** Only browser-restricted keys go in `VITE_*`.
   Google Books search works with no key at all. If a secret is ever needed,
   add a server proxy rather than a `VITE_` variable.
8. **Do not hard-code any specific book.** `src/data/seed.ts` holds invented
   placeholders for layout work and is imported by nothing.
9. **The 3D room is an enhancement, never the only way in.** Browsers without
   WebGL and a canvas that has thrown fall through to list mode, and the list is
   one tap away everywhere else. Anything reachable by clicking a book in the
   room must be reachable from the list too.
10. **Navigation is chosen by pointer type, not by screen size.**
    `App` picks `pointer-lock` or `touch` from `useIsCoarsePointer` and passes it
    to `LibraryScene`, which mounts `PlayerControls` or `TouchControls`. Neither
    knows about the other. Everything they share - collision, the room plan, the
    shelf layout - is pure and does not care what is driving the camera, so a
    third scheme (a gamepad, say) is one more sibling and no edits elsewhere.

## Touch

- **The shell is an app shell, not a shrunken HUD.** Three destinations in the
  tab bar (`HudTab` in `LibraryHud`), the one create action on a `Fab`, and
  Room/Shelf as a segmented control in the header — a view toggle, not a place.
  `activeTab` is DERIVED from `overlay` in `App`, never stored beside it: two
  things that both claim to know where the reader is will disagree eventually.
- `Panel` grows a third placement, `screen`, for those tab destinations: on
  touch it fills the viewport down to `--tab-bar-height` and leaves the bar
  showing, because the bar is how the reader got there and how they leave. On a
  pointer `screen` is just `center`. Sheets that are NOT destinations get a
  grabber and `useSheetDismiss` (drag down to throw away); a destination does
  not, since it has no bottom edge free to throw it past.
- The canvas is told to stop drawing (`paused`) while a full-screen tab covers
  it. The scene is frozen anyway and a phone is not plugged in.
- `public/icon.svg` is the source of truth for the app icons; the PNGs beside it
  were rasterised from it with headless Chrome rather than by adding an image
  library to devDependencies. Redraw them the same way if the mark changes.
- `TouchControls` is the mobile camera: drag to look, tap anywhere in the room to
  walk there, pinch to lean in. No on-screen joystick - it would fill a quarter
  of a small screen with the one thing on it that is not the library.
- **Tap-to-walk is on a `<group>` around the whole room, not on the floor.**
  `fov` is VERTICAL, so a phone held upright sees perhaps 40 degrees across and
  its nearest visible floor is metres away - a floor-only target leaves most of
  the screen dead. Tapping a bookcase or a wall heads towards it and
  `moveWithCollisions` stops the reader at reading distance. This only works
  because every interactive object (`Book3D`, `Desk`, `SuggestionBox`) calls
  `stopPropagation`. **If you add something clickable to the room, it must too**,
  or tapping it will also walk the reader into it.
- **The browser synthesises a `click` at the end of a look-drag.** `TouchNavState.dragged`
  is what stops that click walking the reader to wherever their finger stopped.
  It is reset on `pointerdown` and deliberately NOT on `pointerup`, because the
  click arrives after the release and has to still be able to see it.
- `restingFov` widens the lens on a narrow screen and `viewingDistance` stands
  the reader further back to compensate; both are pure and tested. Landscape
  returns to the room's own 62 degrees on rotation.
- `coarse:` (a custom variant in `index.css`, matching the media query
  `useIsCoarsePointer` watches) is how controls grow to 44px on touch without a
  breakpoint guess. `coarse:text-base` on inputs is load-bearing: mobile Safari
  zooms the page in on a field under 16px and never zooms back out.

## Pointer lock (desktop)

Three ways drei's `PointerLockControls` fights the app. All three are handled —
these are notes on WHY the handling looks odd, not outstanding problems. Undo any
of them and the symptom comes straight back.

- **It is UNMOUNTED, not merely disabled, whenever a panel is open**, and its
  click-to-lock handler is narrowed to the canvas with `selector`. Its own effect
  ignores `enabled`, so a mounted instance re-locks the pointer on every click —
  including clicks into a dialog's text fields, which then forces the reader to
  press Escape, which closes the dialog. `useEscapeKey` ignores Escape while the
  pointer is locked for the same reason.
- **Unmounting it is not enough on its own.** The click that opens a panel is
  also the click drei locks on, and `requestPointerLock` resolves AFTER the
  effect that calls `exitPointerLock` has run — so the panel opened with the
  pointer already captured: no cursor to press its buttons with, and because a
  locked canvas raycasts from the crosshair, every later click re-picked the book
  that opened the panel, over and over. `PlayerControls` therefore listens for
  `pointerlockchange` and keeps releasing for as long as a panel is open, rather
  than releasing once and assuming.
- **Picking is re-asserted from `useFrame`, not from an effect.** drei forces r3f
  to raycast from the centre of the screen; `PlayerControls` overrides that
  `compute` so picking follows the mouse when unlocked and the crosshair when
  locked. drei rewrites `events.compute` whenever it connects and restores
  whatever it saw at mount when it disconnects, so which version survived a panel
  opening and closing came down to the order React ran a parent's effect and a
  remounting child's in — not a thing to bet picking on. A reference comparison
  per frame cannot be raced. If picking ever starts opening the wrong book, look
  here first.

## Performance rules

- Structural materials come from `three/materials/useSharedMaterials.ts`. Do not
  create a new `MeshStandardMaterial` per mesh.
- Surface texture is drawn on a canvas at startup by
  `three/materials/proceduralTextures.ts` and cached by key, so grain costs one
  texture per surface type rather than per mesh, and the repo stays asset-free.
  Anything tiled must be seamless: blotches at arbitrary positions do not wrap,
  and their cut edges line up into a grid that reads as brickwork.
- Cover textures are cached by URL in `three/materials/useCoverTexture.ts`.
- One shadow-casting light. Adding more is the fastest way to tank the frame
  rate in a room this size.
- `dpr` is capped in `LibraryCanvas`; `AdaptiveDpr` drops it under load.
- A book is ONE mesh with a six-material array and no text — the cover already
  carries the title. Keep it that way; it is what makes a wall of them
  affordable. Once a shelf holds a few hundred, move the bodies to a single
  `InstancedMesh` and keep only interaction per-book. The layout system already
  returns flat placement data suited to that.
- Per-frame values live in refs, never in state. `Book3D` animating its entry
  through `useState` would re-render React 60 times a second, per book.

## Loading and caching

Measured, not assumed — the numbers below came from a production build driven in
real Chrome, and they are the reason the loading states are where they are.

- **The book APIs are NOT called on startup.** Nothing touches Google Books or
  Open Library except `useBookSearch`, while the reader is typing in the add
  dialog. A `Book` is stored complete — title, authors, cover URL, page count —
  so the library is whole offline.
- **Reading the library out of localStorage takes under 0.1 ms.** `LoadingVeil`
  is covering essentially nothing. Do not add a skeleton for "books loading";
  there is no wait to cover, and a placeholder that flashes for one frame is
  worse than no placeholder.
- **Covers are the only thing genuinely fetched on every visit**, so that is
  where the skeletons are: `BookCover` sizes a placeholder to the exact box the
  image will fill, and `BookSearchResults` shows result-shaped rows rather than
  a spinner. Nothing reflows when the image lands.
- Cover images are cached by the BROWSER, not by us: Open Library sends
  `max-age=10800`, Google `private, max-age=86400`. An app-level cache would buy
  offline covers and nothing else — worth it only alongside a service worker.
- **A cover URL is never stored unverified.** Open Library will mint one for any
  ISBN and `default=false` then 404s when there is no scan behind it, so
  `OpenLibraryProvider` HEADs the URL before claiming it and `normalise` takes a
  cover only from `cover_i`. Storing an unchecked one is not a cosmetic problem:
  it costs a failed image request on every load of the library forever, and it
  hides the fact that the book has no art — the search row cannot say so if a
  URL is present. That row says it in words because the generated cover is
  drawn at 400x600 and rendered at 56 wide, where its title is unreadable and it
  degrades into a blank-looking swatch.
- `BookService` already memoises searches by query for the session
  (`searchCache`), so typing back and forth does not re-hit the API. It is
  unbounded; a session long enough for that to matter would be surprising.

## Known gaps (deliberate)

- The room's spawn aims at the FIRST BOOK rather than the middle of the case, so
  a small collection sits off to one side with bare wall beside it. Deliberate on
  a wide screen; it reads as emptier on a phone, where the view is narrower.
- `TouchControls` has no inertia on the look-drag and no way to walk backwards
  except tapping behind you - turn first, then tap.
- The 3D layer has no automated coverage — jsdom has no WebGL, so `App.test.tsx`
  exercises the list-mode path only. Everything the room does that is worth
  asserting lives in `utils/` (layout, collision, dimensions, gestures) and is
  tested there; the scene itself has to be looked at. Touch navigation, the app
  shell and the cover pipeline were proved by driving real Chrome under device
  emulation — never on a physical handset, so the safe-area insets in particular
  are reasoned rather than seen.
- `drei/Text` fetches its default font from a Google CDN on first render, so
  the desk label and the empty-shelf card are blank offline. Bundling a font
  would fix it. Books are unaffected — they carry no text.
- Cover textures are cached by URL and never evicted, and so are the spine
  colours sampled from them (`three/materials/useCoverColor.ts`). Fine for a
  personal library; a shared one would want an LRU.
- A book with a Google-only cover and NO ISBN still wears a generated cover in
  the room — there is nowhere CORS-clean to fetch its jacket from. It shows the
  real one in Shelf view, where a plain `<img>` has no such restriction.
- Google Books rate-limits unkeyed clients by IP, so searches quietly fall back
  to Open Library, whose metadata and cover coverage are patchier. Set
  `VITE_GOOGLE_BOOKS_API_KEY` to stay on Google.
- A key with an HTTP referrer restriction has to allow the origin the app is
  served from — `http://localhost:5173/*` for `pnpm dev`. The app sends
  `Referer: <origin>/` under the browser default `strict-origin-when-cross-origin`;
  a report of `referer <empty>` therefore came from curl, Postman or an address
  bar, NOT from the app. A refused key is not fatal (searches fall through to
  Open Library) so it is easy not to notice — `GoogleBooksProvider` warns once
  in dev when it gets a 403 with a key set.
- `Panel` has no focus trap. Escape closes and focus is visible, but Tab can
  still walk behind an open dialog.
- The touch shell has no history integration: Android's back gesture leaves the
  app rather than closing a sheet or returning to the Library tab.
