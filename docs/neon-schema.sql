-- The Stacks: schema for the Neon Data API.
--
-- Run in the Neon SQL editor AFTER enabling the Data API on the branch, which
-- is what creates the `anonymous` and `authenticated` roles.
--
-- Do NOT paste the whole file at once. Step 1 is safe to run immediately; step 2
-- needs your user id, which does not exist until you have signed in once, and it
-- now refuses to run until the placeholder is replaced.
--
-- Safe to re-run: every statement is idempotent, so if something goes wrong you
-- can fix it and paste the whole thing again.
--
-- There are two steps. Step 1 is everything that does not need to know who you
-- are. Step 2 needs your user id, which does not exist until you have signed in
-- once, so it is at the bottom and clearly marked.

-- ===========================================================================
-- STEP 1: run this now
-- ===========================================================================

create table if not exists books (
  id               text primary key,
  -- Set by a default in step 2, so the app never has to send it.
  owner_id         text not null,
  title            text not null,
  authors          text[] not null default '{}',
  description      text,
  cover_image      text,
  thumbnail_image  text,
  isbn10           text,
  isbn13           text,
  publisher        text,
  published_date   text,   -- providers return years, year-months and full dates
  page_count       integer,
  categories       text[],
  preview_url      text,
  date_started     date,
  date_finished    date,
  status           text not null check (status in ('read', 'reading', 'want_to_read')),
  -- Half steps, not an integer: the model documents 0.5 to 5.
  rating           numeric(2, 1)
                   check (rating in (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)),
  thoughts         text,
  favorite_quote   text,
  would_recommend  boolean,
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
  -- Database-side bookkeeping; the model only carries createdAt.
  updated_at  timestamptz not null default now()
);

-- Enabling the Data API grants `authenticated` full CRUD on the whole public
-- schema. RLS is therefore the ONLY thing between a signed-in stranger and this
-- library. Miss one of these two lines and the table is wide open.
alter table books enable row level security;
alter table suggestions enable row level security;

-- `anonymous` starts with no permissions at all. Hand it exactly two things:
-- read the shelf, and post through the suggestion slot.
grant usage on schema public to anonymous;
grant select on books to anonymous;
grant insert on suggestions to anonymous;

-- The shelf is public, every status included.
drop policy if exists books_public_read on books;
create policy books_public_read on books
  for select to anonymous, authenticated using (true);

-- Anyone may post a suggestion, but nobody may pre-triage one.
drop policy if exists suggestions_public_insert on suggestions;
create policy suggestions_public_insert on suggestions
  for insert to anonymous, authenticated with check (status = 'unread');

-- The suggestion box is a slot, not a wall: there is deliberately no SELECT
-- policy for `anonymous`, so a visitor can post but cannot read the box.

-- ===========================================================================
-- STEP 2: sign in to the app once, then run
--
--     select auth.user_id();
--
-- and replace BOTH occurrences of OWNER_ID below with the value it returns
-- (keep the single quotes). Nothing above this line needs changing.
-- ===========================================================================

-- Refuses to run until the placeholder is replaced. Pasting the whole file in
-- one go would otherwise leave the literal text 'OWNER_ID' as both the default
-- and the policy comparison, which quietly matches and hands write access to
-- ANY authenticated user. The concatenation below survives a find-and-replace
-- of the placeholder, so the guard cannot be substituted away by accident.
do $$
declare owner_id_value text := 'OWNER_ID';
begin
  if owner_id_value = 'OWNER' || '_ID' then
    raise exception
      'Step 2 not ready: replace the placeholder with the value of select auth.user_id() first';
  end if;
end $$;

-- So the app never sends owner_id, and cannot get it wrong.
alter table books alter column owner_id set default 'OWNER_ID';

-- Pinned to your literal id rather than "any authenticated user", so the
-- library stays yours even if sign-up is ever opened by accident.
drop policy if exists books_owner_write on books;
create policy books_owner_write on books
  for all to authenticated
  using (owner_id = 'OWNER_ID')
  with check (owner_id = 'OWNER_ID');

drop policy if exists suggestions_owner_read on suggestions;
create policy suggestions_owner_read on suggestions
  for select to authenticated using (auth.user_id() = 'OWNER_ID');

drop policy if exists suggestions_owner_update on suggestions;
create policy suggestions_owner_update on suggestions
  for update to authenticated using (auth.user_id() = 'OWNER_ID');

drop policy if exists suggestions_owner_delete on suggestions;
create policy suggestions_owner_delete on suggestions
  for delete to authenticated using (auth.user_id() = 'OWNER_ID');

-- ===========================================================================
-- Verify. Both rows must come back with rowsecurity = true. If either is false,
-- that table is readable and writable by any signed-in user.
-- ===========================================================================

select relname as table_name, relrowsecurity as rowsecurity
from pg_class
where relname in ('books', 'suggestions');
