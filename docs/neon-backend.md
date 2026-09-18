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

## Schema

```sql
create table if not exists books (
  id               text primary key,
  owner_id         text not null default auth.user_id(),
  title            text not null,
  authors          text[] not null default '{}',
  description      text,
  cover_image      text,
  thumbnail_image  text,
  isbn10           text,
  isbn13           text,
  publisher        text,
  published_date   text,
  page_count       integer,
  categories       text[],
  date_started     date,
  date_finished    date,
  status           text not null check (status in ('read', 'reading', 'want_to_read')),
  -- Not an integer: the model documents 0.5 to 5 in half steps.
  rating           numeric(2, 1)
                   check (rating in (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)),
  thoughts         text,
  favorite_quote   text,
  would_recommend  boolean,
  preview_url      text,
  source           text,
  source_id        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists books_status_idx on books (status);

create table if not exists suggestions (
  id          text primary key,
  title       text not null,
  author      text,
  note        text,
  status      text not null default 'unread'
              check (status in ('unread', 'considering', 'added', 'dismissed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

`published_date` stays `text` because providers return years, year-months and
full dates interchangeably, and the model already treats it as a string.

`suggestions.updated_at` has no counterpart on the model, which only carries
`createdAt`. It is database-side bookkeeping; the mapper neither sends nor reads
it.

## Grants and policies

```sql
alter table books enable row level security;
alter table suggestions enable row level security;

-- Anonymous starts with nothing. Hand it exactly two capabilities:
-- read the shelf, and post through the slot.
grant usage on schema public to anonymous;
grant select on books to anonymous;
grant insert on suggestions to anonymous;

-- The shelf is public.
create policy books_public_read on books
  for select to anonymous, authenticated using (true);

-- Anyone may post a suggestion, but not pre-triage it.
create policy suggestions_public_insert on suggestions
  for insert to anonymous, authenticated with check (status = 'unread');
```

Then, with your user id from step 5:

```sql
-- Replace OWNER_ID with the value of select auth.user_id().
create policy books_owner_write on books
  for all to authenticated
  using (owner_id = 'OWNER_ID')
  with check (owner_id = 'OWNER_ID');

create policy suggestions_owner_manage on suggestions
  for select to authenticated using (auth.user_id() = 'OWNER_ID');

create policy suggestions_owner_update on suggestions
  for update to authenticated using (auth.user_id() = 'OWNER_ID');

create policy suggestions_owner_delete on suggestions
  for delete to authenticated using (auth.user_id() = 'OWNER_ID');
```

Pinning writes to a literal id rather than to "any authenticated user" is what
keeps the library yours even if sign-up is ever opened by accident.

## Migrating the books already in your browser

They only exist in the browser that added them, so this has to run there, once,
before anything clears that key. Read `the-stacks:books:v1`, POST each row to
the Data API as the signed-in owner, then confirm the count before touching
local state. Worth building as a visible one-time action rather than a silent
effect on load, so a half-finished migration is obvious.

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

## Still to decide

- **Hosting.** Nothing is deployed yet, so "people coming in" cannot happen
  regardless of storage. Vercel is the least work for a Vite SPA.
- Rate limiting on the suggestion slot. There is none, and the open internet
  will find it eventually.
