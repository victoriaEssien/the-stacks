# Project Spec — My Virtual Library ("The Stacks")

## 1. Overview

Build a personal, interactive 3D virtual library that represents my reading life.
The experience should feel like entering a small, cozy digital library rather than using a conventional book-tracking dashboard.

The core concept:

- The books in the library are books I have actually read.
- As I read more books, my virtual library grows.

Users should be able to:

- Walk around the library in 3D.
- See books physically placed on shelves.
- Interact with individual books.
- View metadata and personal thoughts about each book.
- Add books I've finished reading.
- Search for books using an external book API.
- Automatically retrieve book metadata and cover artwork.
- Leave book recommendations/suggestions in a physical suggestion box.
- View and manage those suggestions.
- Eventually expand the environment and functionality without needing to rebuild the architecture.

## 2. Primary Experience

When the application loads, the user enters a 3D library. The environment should contain:

1. **Bookshelves** — contain books that have been read. Books should look like physical books rather than flat cards, each with a visible spine, varying slightly in height, width and appearance. The number of books/shelves grows with reading history.
2. **Reading desk** — represents current reading activity; can display the currently reading book and eventually bookmarks, notes, a lamp.
3. **Suggestion box** — a physical mailbox where recommendations are submitted (title and/or author) and are visible when interacting with the box.
4. **General library environment** — cozy and atmospheric, a personal space, not a generic corporate dashboard.

## 3. MVP

Do NOT attempt to build the entire vision immediately. The first working version:

**3D environment** — one library room, one or more bookshelves, a desk, a suggestion box, basic lighting, basic camera controls.

**Books** — at least one book can be added; books are 3D objects; spine displays title/author where practical; cover can use externally retrieved artwork; clicking a book opens its information panel.

**Book information** — title, author, cover, publication information where available, rating, date started, date finished, personal thoughts, favorite quote, recommendation status.

**Book search** — an "Add Book" interface that queries an external book API and shows matching results; the user selects a result and adds it. Metadata is stored locally/database-side rather than re-queried on every view.

**Suggestions** — the suggestion box accepts a book title, optional author and optional note. Submitted suggestions are stored and retrievable.

## 4. Book API

Use an external book metadata API. Preferred initial source: **Google Books API**, retrieving where available title, authors, description, publisher, published date, ISBN, categories, page count, cover image, preview information.

Consider **Open Library** as a secondary/fallback source, particularly for cover artwork.

Do not tightly couple the application to one API. Create a book-service abstraction:

```
BookService
  ├── GoogleBooksProvider
  └── OpenLibraryProvider
```

The rest of the application consumes normalized book data, never Google Books-specific response structures.

## 5. Normalized Book Model

```ts
Book {
  id: string

  title: string
  authors: string[]

  description?: string

  coverImage?: string
  thumbnailImage?: string

  isbn10?: string
  isbn13?: string

  publisher?: string
  publishedDate?: string

  pageCount?: number
  categories?: string[]

  dateStarted?: string
  dateFinished?: string

  status: "read" | "reading" | "want_to_read"

  rating?: number

  thoughts?: string
  favoriteQuote?: string

  wouldRecommend?: boolean

  source?: string
  sourceId?: string

  createdAt: string
  updatedAt: string
}
```

Keep external API models separate from the application's internal model.

## 6. 3D Book Representation

Books are actual 3D objects with a front cover, back cover, spine, pages/body, slight thickness and appropriate proportions. Use the retrieved cover image as the front cover texture where possible; the spine displays title and/or author.

Books are placed on shelves dynamically — the system calculates shelf placement rather than requiring manually positioned coordinates.

```
Library
 └── Shelf
      ├── Book
      ├── Book
      └── ...
```

The placement system should eventually support multiple shelves, multiple bookcases, automatic wrapping to the next shelf, automatic creation of additional shelves/bookcases, and small randomized rotations/positions for visual variety.

## 7. Interaction

**Desktop** — WASD / arrow keys for movement, mouse for camera/look, mouse click for interaction.

**Book interaction** — hovering gives subtle visual feedback and an interactive cursor. Clicking selects the book and displays a 2D information panel without removing the user from the 3D environment. The panel includes the cover and personal reading information, and a clear way to close it.

## 8. Adding a Book

An unobtrusive `+ Add Book` action opens:

```
Add a book

[ Search title, author, ISBN... ]

Search results
----------------------------
[cover] Saving Noah
       Abigail Thomas

       [Add to Library]
----------------------------
```

After selecting a book, an optional personal-information form:

```
Rating: ☆ ☆ ☆ ☆ ☆
Started: [date]
Finished: [date]
Thoughts: [...]
Favorite quote: [...]
Would recommend? [ Yes ] [ No ]
[Add to Library]
```

Once added: persist the book, add it to the library, update the 3D environment, and animate the new book appearing on the shelf if practical. The animation should be subtle and polished rather than gimmicky.

## 9. Reading Status

Support `want_to_read`, `reading`, `read`. The primary physical library represents **read** books. "Want to read" books do NOT appear on the main read bookshelf. The current "Reading" book can optionally appear on the reading desk.

## 10. Suggestion Box

A physical interactive object. Form: book title, author, note. After submission, create a suggestion record and optionally animate a small note being placed into the box.

```ts
Suggestion {
  id: string
  title: string
  author?: string
  note?: string
  status: "unread" | "considering" | "added" | "dismissed"
  createdAt: string
}
```

Interacting with the box allows viewing submitted suggestions.

## 11. Reading Dashboard

Avoid turning the project into a traditional dashboard, but provide lightweight statistics: books read, currently reading, this year, average rating. Potential future statistics: pages read, favorite genres, favorite authors, longest book, most-read author, reading timeline. These are secondary to the 3D experience.

## 12. Design Direction

Cozy personal library / dark academia / warm study. Wooden bookshelves, warm lighting, desk, reading chair, lamp, rug, plants, small decorative objects, subtle ambience. Do not overload the scene — performance and readability matter more than visual complexity. Beautiful but calm.

## 13. Technical Direction

React, TypeScript, Three.js, React Three Fiber, Drei where useful, modern CSS / Tailwind if appropriate. Choose supporting libraries based on actual requirements.

```
src/
├── components/{ui,books,library,suggestions}/
├── three/{LibraryScene,Bookshelf,Book,Desk,SuggestionBox,lighting}/
├── services/books/{BookService,GoogleBooksProvider,OpenLibraryProvider}
├── models/{Book,Suggestion}
├── data/
├── hooks/
└── utils/
```

## 14. Persistence

Local persistence is acceptable for the prototype (localStorage, IndexedDB or similar). The architecture should make it possible to replace this later with a backend/database. Do not build authentication unless necessary for the MVP. Future possibilities: Supabase, PostgreSQL, Firebase, custom API. Do not introduce a backend simply for the sake of having one.

## 15. Performance Requirements

Avoid extremely high-poly assets, huge textures, unnecessary asset loading, hundreds of unique heavy materials, unnecessary re-renders and repeated API requests.

Use texture reuse, lazy loading, appropriate texture sizes, instancing where useful, frustum culling where useful, and efficient React Three Fiber patterns. The initial library should comfortably handle dozens of books; architecture should not make hundreds impossible later.

## 16. Responsive / Accessibility

Desktop is the primary experience, but the UI adapts to smaller screens, the app detects devices where keyboard/mouse 3D navigation is impractical, and provides an alternative browsing mode. Important book information stays accessible without 3D interaction. The 3D environment enhances the experience rather than being the only way to access information.

## 17. Error Handling

Handle: book API unavailable, no search results, missing cover image, invalid/missing metadata, duplicate books, failed persistence, texture loading failures.

If a cover cannot be loaded, use a visually attractive generated/default cover rather than a broken image. If the API returns incomplete metadata, still allow the user to add the book.

## 18. Future Features

Not before the MVP is stable. Reading milestones (streaks, goals, challenges); personalization (multiple rooms, genre sections, favorites display, author collections); social (public library link, friends suggesting books, shared recommendations, guestbook); rich interactions (pick a book off the shelf, open it, turn pages, bookmarks, handwritten notes); discovery (random book, "what should I read next?", mood-based and API-powered recommendations); environment (day/night cycle, weather outside the window, fireplace, ambient audio, seasonal decorations).

## 19. Important Product Principle

The application should not become another productivity tracker that pressures the user to read.

> "This is my library, and it grows as I read."

The visual growth of the library should naturally encourage continued reading. Do not overemphasize streaks, quotas, leaderboards or productivity metrics.

## 20. Development Approach

- **Phase 1 — 3D prototype:** library room, bookshelf, desk, suggestion box, camera/navigation, basic lighting, placeholder books.
- **Phase 2 — Real books:** book model, dynamic shelf placement, book interaction, information panel.
- **Phase 3 — Book API:** search, Google Books provider, normalized model, cover retrieval, add-book workflow.
- **Phase 4 — Persistence:** save books, reading information and suggestions; load the library on startup.
- **Phase 5 — Polish:** materials, lighting, animations, hover states, loading states, empty states, error handling, performance.
- **Phase 6 — Future expansion:** only after the core experience feels good.

## 21. Definition of Done — MVP

1. Open the application.
2. Enter a 3D library.
3. Walk around the room.
4. See bookshelves.
5. Search for a real book.
6. Retrieve its metadata and cover from an external API.
7. Add the book to my library.
8. See the book physically appear on a shelf.
9. Click the book.
10. View my rating/thoughts/reading information.
11. Edit that information.
12. Refresh the page and still see the book.
13. Interact with the suggestion box.
14. Submit a book recommendation.
15. View submitted recommendations.

The experience should feel polished enough that adding a book feels satisfying.

## 22. Agent Instructions

Before writing significant amounts of code:

1. Inspect the existing repository.
2. Identify the current framework/build setup.
3. Reuse existing dependencies where appropriate.
4. Propose any major architectural decisions before implementing them.
5. Do not install unnecessary dependencies.
6. Keep the application runnable after each major phase.
7. Build the MVP before implementing future features.
8. Prefer clean abstractions over hard-coded book-specific logic.
9. Do not hard-code "Saving Noah" into the application. It is only an example/test book.
10. Use environment variables for API keys if the selected API requires them.
11. Never expose secret credentials in client-side code.
12. Include useful loading, empty and error states.
13. Keep 3D rendering logic separate from business/data logic.
14. Make the book API provider replaceable.
15. Write clear TypeScript types.
16. After each major implementation phase, verify that the application builds and runs successfully.

The final result should feel like a real personal digital library, not a generic Three.js demo.
