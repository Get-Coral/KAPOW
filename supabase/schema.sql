create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code varchar(6) not null unique,
  host_token uuid not null unique,
  status varchar(10) not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  song_id varchar(32) not null,
  song_title text not null,
  artist text not null,
  thumbnail_url text not null,
  submitter_name varchar(32) not null,
  status varchar(10) not null default 'pending' check (status in ('pending', 'waiting', 'playing', 'done')),
  position integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.queue(id) on delete cascade,
  fingerprint varchar(128) not null,
  voter_name varchar(32),
  created_at timestamptz not null default now(),
  unique (queue_id, fingerprint)
);

alter table public.votes
add column if not exists voter_name varchar(32);

alter table public.rooms enable row level security;
alter table public.queue enable row level security;
alter table public.votes enable row level security;

drop policy if exists "rooms_public_read" on public.rooms;
create policy "rooms_public_read"
on public.rooms
for select
to anon, authenticated
using (true);

drop policy if exists "rooms_public_insert" on public.rooms;
create policy "rooms_public_insert"
on public.rooms
for insert
to anon, authenticated
with check (true);

drop policy if exists "rooms_public_update" on public.rooms;
create policy "rooms_public_update"
on public.rooms
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "queue_public_read" on public.queue;
create policy "queue_public_read"
on public.queue
for select
to anon, authenticated
using (true);

drop policy if exists "queue_public_insert" on public.queue;
create policy "queue_public_insert"
on public.queue
for insert
to anon, authenticated
with check (true);

drop policy if exists "queue_public_update" on public.queue;
create policy "queue_public_update"
on public.queue
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "queue_public_delete" on public.queue;
create policy "queue_public_delete"
on public.queue
for delete
to anon, authenticated
using (true);

drop policy if exists "votes_public_read" on public.votes;
create policy "votes_public_read"
on public.votes
for select
to anon, authenticated
using (true);

drop policy if exists "votes_public_insert" on public.votes;
create policy "votes_public_insert"
on public.votes
for insert
to anon, authenticated
with check (true);

drop policy if exists "votes_public_delete" on public.votes;
create policy "votes_public_delete"
on public.votes
for delete
to anon, authenticated
using (true);

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.queue;
alter publication supabase_realtime add table public.votes;
