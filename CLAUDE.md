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
   CDNs — which host serves what, and which of it is safe to fetch — because
   that is provider knowledge too, and the 3D layer needs the answer.
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
   **Where the reader STANDS is part of that plan too** (`spawnPoint`,
   `framedWidth`): it is pure geometry, it depends on the room, and it has to be
   clamped against the same footprints collision uses.
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

11. **`api/` is ours, and it is the only server there is.** Two Vercel
    functions: `api/cover.ts` and `api/search.ts`. Four rules keep them working.
    - TypeScript path aliases do NOT work inside `api/` (Vercel's own docs say
      so), so imports there are relative.
    - **Those imports name the COMPILED file: `./covers.js`, not
      `./covers.ts`.** Vercel transpiles each function file on its own and
      leaves the specifier untouched, so a `.ts` specifier resolves to a file
      that is no longer there. This is not theoretical - it took production down
      with `ERR_MODULE_NOT_FOUND: /var/task/src/services/books/coverProxy.ts`.
      It is the ordinary TypeScript ESM convention and `tsc` resolves it back to
      the `.ts` source.
    - The behaviour lives in `src/services/books/` so that
      `tooling/apiDevPlugin.ts` can run the SAME handlers on the dev server; a
      second implementation for `pnpm dev` would be the one that is never tested
      and never right. It reaches them through `ssrLoadModule`, NOT an import,
      so that nothing under `src/` is in the Vite config's runtime graph - Vite
      resolves a `.js` specifier to a `.ts` file, and the Node-based config
      loader that Vite is moving to would not.
    - The client imports endpoint PATHS from `services/books/endpoints.ts`,
      never from a handler's module, so a server handler is not in the browser's
      module graph waiting on tree shaking to save it.

## The cover proxy

`/api/cover?src=<url>` re-serves someone else's cover art from our origin.

- **Why it exists:** a WebGL texture must come from a CORS-clean image, and
  Google serves the best jackets with no `Access-Control-Allow-Origin` at all.
  The room used to answer that by fetching the same ISBN from Open Library
  instead, so one book wore publisher art in the panel and an archive.org scan
  in the room, and wore nothing at all when Open Library had no scan behind that
  ISBN. Routing textures through our own origin removes the fork: `<img>` and
  texture now load the same bytes.
- **`proxyableCoverUrl` is an allowlist (`COVER_HOSTS`), not a guard.** This
  library is public, so without one the endpoint is a general purpose image
  proxy anybody can point at anything and bill to us. Subdomains count, so
  `archive.org` covers the mirror an Open Library cover redirects to, and
  `books.google.com.example.test` does not match. It also insists on HTTPS
  (`http:` is upgraded, not refused), no embedded credentials and no odd port.
  The response side adds the rest: image content types only, a 5 MB cap and an 8
  second timeout, because a host being the right host says nothing about what it
  returns today.
- **The cost of the allowlist is that a cover pasted from somewhere else shows
  everywhere EXCEPT the room**, so the edit form names the host and says what
  will happen rather than leaving it to be discovered. Adding a host is one line
  in `COVER_HOSTS`, and it applies to the client and the endpoint together
  because both call `proxyableCoverUrl`.
- Redirects are followed, because Open Library answers through two hops to
  archive.org. The hop targets are chosen by the upstream host and not by the
  caller, so this does not widen what the guard just decided.
- **The edit form's "Cover image URL" field is the escape hatch**, for a book
  no provider has art for and for a jacket from the wrong edition. It starts
  from the cover the book already has, so the art can be seen and corrected in
  one place, and an EMPTY box is a real choice: it means the drawn cover, not
  "keep whatever the provider guessed".
- Every refusal is a bare status: 400 for a `src` we will not fetch, 404 for a
  book nobody has scanned, 502 for anything else. The app treats all three the
  same — try the next candidate, then draw a cover — so the codes are for
  whoever is reading the network tab.

## The search endpoint

`/api/search?q=<query>` (or `?id=<volume id>`) is Google Books with the key
held server side.

- **`GOOGLE_BOOKS_API_KEY` has no `VITE_` prefix, and that is the point.** A
  `VITE_` variable is inlined into the bundle and is therefore public; this one
  is read by `api/search.ts` from `process.env`. Verified after the move: the
  key appears in no built asset, and the browser can reach neither it nor
  `googleapis.com`. Because the key is no longer public, its HTTP referrer
  restriction is now a convenience rather than the thing protecting it.
- **`pnpm dev` reads it through `loadEnv(mode, envDir, '')`** in the dev plugin,
  with an empty prefix so unprefixed variables are included. A change to the key
  therefore needs a dev server RESTART, not a reload. The plugin warns on boot
  when it is missing rather than letting searches be quietly rate limited.
- **The endpoint is a PIPE: Google's JSON goes back untouched**, so
  `GoogleBooksProvider` keeps the only copy of the normalising code and nothing
  outside `services/books/` learns a provider's response shape. It forwards only
  a query or a volume id, never the caller's other parameters, because passing
  those through would make it a general purpose Google Books proxy carrying our
  key.
- **Upstream status codes are passed through, bodies are not.** `fetchJson`
  turns 429 into a rate limit and 403 into a refused key, and the reader is
  shown that rather than an unexplained empty result. The body is dropped
  because Google's error JSON quotes the key back at you.
- **`callerOrigin` is a deterrent, not a security boundary.** It checks
  `Sec-Fetch-Site` and `Referer`, both of which come from the caller. It is
  there because this endpoint spends our Google quota, and without it the
  endpoint is a keyless Google Books API that anyone reading the page source can
  point a scraper at. Browsers send those headers honestly, so it stops the
  casual version, which is the only version that was going to happen. Both
  headers are consulted because neither is universal, and the origin it returns
  is forwarded to Google as the `Referer` so a referrer-restricted key keeps
  working from a server.

## Searching

**Google Books is the only search provider, and its own relevance is not good
enough to use directly.** Measured against the live API while looking for
"Keep It in the Family" by John Marrs, and for Pretty Girls by its ISBN:

| query                             | result                                                    |
| --------------------------------- | --------------------------------------------------------- |
| `keep it in the family`           | not in the first 40 results                               |
| `intitle:"keep it in the family"` | third                                                     |
| `john marrs`                      | no book by him at all: a study guide, then county records |
| `inauthor:"john marrs"`           | first                                                     |
| `9780062429063`                   | **zero results**                                          |
| `isbn:9780062429063`              | exactly the right book                                    |

- So `searchQueries` in `services/books/searchRanking.ts` builds SEVERAL
  queries and `GoogleBooksProvider` runs them in parallel, merging the results.
  No single form can replace the plain query, because the author-plus-title
  phrasing a reader falls back to (`john marrs keep it in`) matches no single
  field. `q OR intitle:"q"` was measured too and finds neither.
- **An ISBN replaces the plain query rather than joining it**, since the plain
  form returns nothing for one and an ISBN identifies exactly one book.
- The author query is only added for a query of three words or fewer. A longer
  phrase is nobody's name, and each query costs a request against a daily quota.
- **`rankByRelevance` scores authors as highly as titles, and it has to.** For
  an author search the right books come from the `inauthor:` query and their
  titles have nothing to do with what was typed, so scoring titles alone would
  leave Google's plain-query noise sitting on top of them. Within a score band
  the order Google gave is preserved, because when nothing matches by name its
  relevance is the only signal there is.
- **Open Library is no longer a search fallback.** It used to sit behind Google
  so a failed search still returned something, and that was the wrong trade:
  its records are thin (often no page count, no description, a different
  edition's cover) and a book added from one is a worse record forever. A
  search that fails and says so beats a bad result that does not. It stays on
  as `BookService`'s `coverFallback`, which is a different job: finding a jacket
  for a book Google has no image for, verified with a HEAD before it is claimed.

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

## The room is furnished as a library

- **Every wall the base room can hold a bookcase against gets one, whether or
  not there is anything to put on it.** `furnishedCaseCount` is the minimum and
  `baseRoomCapacity` computes it - four cases on the back wall and three on each
  side, ten in total, fifty shelves. Not a chosen number: it is what the room's
  own width and depth allow, and `requiredDepth` of it is still the base depth,
  so furnishing the walls costs no extra room. A test asserts those two
  calculations cannot drift apart.
- The point is that this is a LIBRARY. One bookcase alone in a nine metre room
  reads as an empty room with a bookcase in it, no matter how good the bookcase
  is. Beyond the base capacity the old behaviour takes over and the room deepens.
- **Furnishing the walls broke the spawn, and the fix is worth knowing.** Books
  pack from the first case, and with one case that case was the middle of the
  back wall; with ten it is the LEFT END of it. Following the books that far put
  the reader in among the side-wall shelves with one filling half the screen.
  `spawnPoint` now clamps both axes into the open floor, and a test walks every
  screen shape past `isBlocked` with the real obstacle list to prove the reader
  never arrives inside the furniture.
- **`framedWidth` frames TWO bookcases, and that number was arrived at by
  looking.** Framing the whole back run stands the reader so far back that the
  shelves occupy the top third of the screen and the rest is floor; framing one
  case reads as a single piece of furniture rather than a wall. Two is the
  narrowest frame that reads as shelving.
- `src/data/seed.ts` exists for exactly this kind of work: `placeholderBooks(n)`
  fills the shelves with invented titles so the layout can be judged at a size
  the real library has not reached. Nothing imports it.

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
- Cover images are cached by the browser and, for textures, by our own CDN:
  `/api/cover` sends `max-age=86400, s-maxage=31536000`, so the second visitor's
  texture costs no upstream request at all. Upstream is stingier by comparison
  (Open Library `max-age=10800`, Google `private, max-age=86400`), which is a
  second reason the proxy earns its keep. Storing the bytes ourselves would buy
  covers that cannot rot — worth doing, and not done yet.
- **A cover URL is never stored unverified.** Open Library will mint one for any
  ISBN and `default=false` then 404s when there is no scan behind it, so
  `OpenLibraryProvider` HEADs the URL before claiming it and `normalise` takes a
  cover only from `cover_i`. Storing an unchecked one is not a cosmetic problem:
  it costs a failed image request on every load of the library forever, and it
  hides the fact that the book has no art — the search row cannot say so if a
  URL is present. That row says it in words because the generated cover is
  drawn at 400x600 and rendered at 56 wide, where its title is unreadable and it
  degrades into a blank-looking swatch.
- **Book covers are 128px because that is all Google advertises.** Its
  `imageLinks` offer only `thumbnail` and `smallThumbnail` for most volumes,
  even ones it holds a 1744px scan of, so `coverImage` is a 128x193 thumbnail
  stretched across a book the reader can walk up to. Asking for a bigger one is
  a lottery, measured across eight volumes: `&w=800` returned a placeholder for
  three, an 800x128 distorted strip for two, and the real scan for one; `&zoom=0`
  was worse. Google marks the placeholder with `Cache-Control: max-age=30` where
  a real scan gets `max-age=86400` — but nothing marks the distorted ones, so a
  large URL can only be trusted by comparing its aspect ratio against the
  thumbnail it should match. That is one check when a book is ADDED, not
  something to redo on every render, which is why the room asks for the cover
  exactly as stored. Storing our own bytes would settle it for good.
- `BookService` already memoises searches by query for the session
  (`searchCache`), so typing back and forth does not re-hit the API. It is
  unbounded; a session long enough for that to matter would be surprising.

## Known gaps (deliberate)

- The spawn still leans towards the first book rather than centring on the room,
  so a small collection sits left of centre. That is on purpose - the books are
  the subject - but it means the right-hand half of the arrival view is empty
  shelving.
- In portrait the reader stands far enough back to get two cases across, and
  because `fov` is vertical that leaves a tall band of bare wall above the
  shelves. Pitching the camera down slightly would fix it; it has not been done.
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
- Google Books rate-limits unkeyed callers by IP, so with no
  `GOOGLE_BOOKS_API_KEY` set, searches will eventually start failing rather
  than degrading: there is no second search provider behind it any more.
  `GoogleBooksProvider` warns once in dev on a 403, because a refused key is
  otherwise easy not to notice.
- `/api/search` has no rate limit of its own. The same-origin check turns away
  casual use and the CDN serves a repeated query for free, but someone
  determined can spend the day's Google quota, after which search stops working
  until it resets. Only the owner can search at all, so it is not worth a token
  check yet.
- A search spends up to three Google requests, one per query form. Fine against
  a 1,000/day quota with one reader, and `BookService.searchCache` means typing
  back and forth costs nothing, but it is the number to look at first if the
  quota ever becomes a problem.
- Three books can share a title, and when they do the order among them is
  Google's. Searching "keep it in the family" puts David F. Hockley's above John
  Marrs's; both are on screen, which is the part that was broken.
- `Panel` has no focus trap. Escape closes and focus is visible, but Tab can
  still walk behind an open dialog.
- The touch shell has no history integration: Android's back gesture leaves the
  app rather than closing a sheet or returning to the Library tab.
