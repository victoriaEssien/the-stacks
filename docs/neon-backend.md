# Moving the library to Neon

The shelf currently lives in `localStorage`, which is per browser and per
device. Nobody else can see it, and neither can you from another machine. This
is the plan for making it a real, shared library.

Status: not implemented. This is the design plus the manual setup, so the
console work and the code can happen in either order.

## What Neon gives us

Verified against the docs (September 2026), not assumed from Supabase parity:

- **Data API**: a PostgREST-compatible REST endpoint over the database,
  validating JWTs and enforcing Row-Level Security. Available on the **Free
  plan**. Currently **Beta**, which is the main risk in this plan.
- **Roles**: requests with no `Authorization` header run as `anonymous`, which
  **has no permissions by default**. Requests with a valid Bearer JWT run as
  `authenticated`.
- **Neon Auth** (managed Better Auth) is on the Free plan, up to 60,000 monthly
  active users. We need exactly one.
- **Free plan caps**: 0.5 GB storage and 100 CU-hours per project, autoscaling
  to 2 CU, and scale-to-zero after 5 minutes of inactivity which **cannot be
  disabled** on Free.

Two consequences of that last point:

1. A visitor arriving at a cold database waits for a resume. For a library this
   small it should be well under a second, but it is not zero, and it will
   happen to almost every visitor because nobody visits often.
2. Reading your own shelf is currently under 0.1 ms (measured). Any network
   round trip is 100 to 300 ms before cold starts. Keep `localStorage` as a
   read-through cache so your own library still opens instantly and still works
   offline, and treat Neon as the source of truth. The "no skeleton needed" note
   in CLAUDE.md stops being true for a first-time visitor.

## No new client dependency

The Data API is plain HTTP. There are client libraries (`@neondatabase/neon-js`,
`@neondatabase/postgrest-js`) but the repository needs five operations and
`services/books/http.ts` already wraps fetch with timeouts and typed failures.
Hand-rolled fetch keeps the dependency count where it is.

Auth is the exception: Neon Auth means the Better Auth client, and that one is
not avoidable.

## The seam is already in place

No caller changes. `Repository<T>` is async and returns `Result<T>`, and
`libraryStore` already writes optimistically and rolls back on failure, which is
what a network store needs. The whole swap is:

```ts
// services/persistence/repositories.ts
export const bookRepository: Repository<Book> = new NeonRepository<Book>('books', isBook);
```

Column names go snake_case in Postgres, so `NeonRepository` needs a row-to-model
mapper. Keep it a pure function next to the class and unit test it; do not let
snake_case leak past this folder.

Book ids stay `text` rather than becoming `uuid`, so the books already in your
browser migrate with their ids intact. That matters: the cover texture cache,
the entry animation and the shelf layout are all keyed on book id.

## Access model

Three patterns, which is what makes this a database question rather than a file
question:

| Operation                   | Who                      |
| --------------------------- | ------------------------ |
| Read the shelf              | anyone, signed in or not |
| Add, edit, remove a book    | only you                 |
| Leave a suggestion          | anyone                   |
| Read and triage suggestions | only you                 |

The suggestion box is deliberately a slot, not a wall: visitors can post through
it, only you can see what is inside. That matches the physical object, and it
means a spammer cannot deface anything visible. Your existing
`unread / considering / added / dismissed` statuses are the moderation queue.

**The trap.** Enabling the Data API auto-grants full CRUD on the whole `public`
schema to `authenticated`. RLS is therefore the only thing standing between a
signed-in stranger and your library. Every table must have
`ENABLE ROW LEVEL SECURITY` or it is wide open. Neon's Data API Advisors will
flag a table that does not.

## Setup, in order

1. Create a Neon project on the Free plan, region **Europe (London)**. The
   region is permanent: "You cannot change the region for an existing project."
   London is roughly 90 to 110ms from Lagos against 170 to 200ms to Ohio, and
   because the browser calls the Data API directly there is no server hop to
   hide that latency behind. Enable the Postgres database and Neon Auth only;
   Object storage, Functions and the AI gateway are not needed.
2. Enable the **Data API** on the primary branch. This creates the `anonymous`
   and `authenticated` roles and applies the default grants.
3. Enable **Neon Auth**, and disable open sign-up so only your account exists.
4. Run the SQL below in the Neon SQL editor.
5. Sign in to the app once, run `select auth.user_id();`, and paste the result
   into the `OWNER_ID` placeholder in the last block.
6. Put the Data API base URL in `.env` as `VITE_NEON_DATA_API_URL`. It is not a
   secret; it is the public endpoint, and the grants plus RLS are the guard. The
   Postgres connection string must never reach the client.
7. Migrate the books out of `localStorage` (see below).

## Schema and policies

The runnable version lives in [`neon-schema.sql`](./neon-schema.sql). Paste that
into the Neon SQL editor rather than copying out of this file. It is idempotent,
so a failed run can be fixed and pasted again, and it ends with a check that RLS
is actually on for both tables.

Two things in it are worth knowing without opening it:

- `rating` is `numeric(2, 1)` constrained to half steps, not an integer. The
  model documents 0.5 to 5.
- `books.owner_id` gets a default of your literal user id in step 2, so the app
  never sends it and cannot get it wrong. That is also why the file has two
  steps: your user id does not exist until you have signed in once.

## Signing in

There is no sign-in link anywhere in the interface, on purpose. A personal
library has exactly one account, so a login control is clutter on a page where
no visitor has anything to sign in to, and it invites poking at the one door.

The owner opens the form at **`/#signin`**. Worth bookmarking, because nothing
on screen points at it.

**It is a one-time code by email, not a password.** The account Neon's console
creates has no password at all, only a `credential` row with a null hash, so
email-and-password sign-in could never have succeeded. A code also beats a magic
link here: the link needs its redirect handled somewhere, while a code stays in
the dialog the reader is already looking at. The project is configured for it
already (`emailVerificationMethod: "otp"`, shared email provider).

This is not a security measure and is not relied on as one. Anyone who guesses
the fragment finds a password form, exactly as they would on any login page; the
password and Row-Level Security are what protect the library. The fragment is
stripped from the URL once acted on, so a reload or a shared link does not keep
reopening the form.

### Signed in is not the same as being the owner

`canEditLibrary` compares the session's user id to `VITE_LIBRARY_OWNER_ID`, not
merely "is there a session". Conflating the two was a real flaw: with sign-up
open on the auth project, a stranger could create an account and then see Add
book, Edit and Remove, with every one refused by RLS. Nothing leaked, but the
library looked broken to them.

It **fails closed**. An unset or mismatched owner id hides the editing controls
rather than showing them, so forgetting the variable in an environment costs a
confusing few minutes, not a permissive UI. `GoogleBooksProvider` is not the
only thing that shouts in dev: the auth store warns once, naming the variable,
when a session arrives that is not the owner's.

The id is not a secret. It is already the literal inside the RLS policy, and it
only decides what gets drawn.

Once signed in, a `Sign out` control appears. That one is safe to show, because
only the owner ever sees it. There is deliberately no sign-up form: the single
account is created in the Neon console, because an account anyone can create
turns a personal library into a shared one by accident.

## Want-to-read books are public

Decided: yes. That means `books_public_read` stays `using (true)` and no policy
work is needed, which is the simpler outcome.

It does leave a presentation bug that only matters once strangers can see the
shelf. Right now:

- the HUD header counts `read` books only (`selectShelvedBooks`)
- Shelf view is handed every book, `want_to_read` and `reading` included
- `ListModeLibrary` renders no status

So the header claims "12 books read" above a grid of more than 12 covers, and a
book you have not started looks exactly like one you finished apart from a
missing star rating. A visitor will read every cover on that grid as a book you
have read. **Fix this before the library goes public**, either with a status
chip on the card or by grouping the grid into read, reading and want-to-read.
The room is unaffected; it shelves `read` only.

## Migrating the books already in your browser

Built, and deliberately an action rather than something that happens on load: a
silent import that half-finishes leaves a library nobody can reason about.

Once signed in, a banner offers the move if this browser is holding anything the
database does not have. The panel lists the titles, imports via `saveMany`
(upserts, so running it twice is harmless), then re-reads the shared library so
what appears is what actually landed rather than what was hoped for.

**Nothing is deleted from localStorage.** Until the database has the books the
browser holds the only copy, and it costs nothing to leave behind afterwards.
`localBookBackup` reads that store directly rather than through
`bookRepository`, because once the app points at Neon those are no longer the
same thing.

The scan only runs for a signed-in owner. A visitor's own localStorage is none
of this library's business, and nothing could be written with it anyway.

## Still to decide

- **Sign-up is still open.** `project_config.email_and_password.disableSignUp`
  is `false`, so anyone can create an account. RLS pins writes to one user id so
  a stranger could not touch the library, but there is no reason to leave the
  door unlocked. Turn it off in the console.
- **`trusted_origins` is empty.** `allow_localhost` is true so development
  works, but the production origin has to be added there before a deployed build
  can sign in. The auth server rejects a request whose `Origin` it does not
  know, which is also why none of this can be tested from Node.

- **Hosting.** Nothing is deployed yet, so "people coming in" cannot happen
  regardless of storage. Vercel is the least work for a Vite SPA.
- Rate limiting on the suggestion slot. There is none, and the open internet
  will find it eventually.
