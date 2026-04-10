create table if not exists public.search_cache (
  query text primary key,
  results jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.search_cache enable row level security;

drop policy if exists "search_cache_public_read" on public.search_cache;
create policy "search_cache_public_read"
on public.search_cache
for select
to anon, authenticated
using (true);

drop policy if exists "search_cache_public_insert" on public.search_cache;
create policy "search_cache_public_insert"
on public.search_cache
for insert
to anon, authenticated
with check (true);

drop policy if exists "search_cache_public_update" on public.search_cache;
create policy "search_cache_public_update"
on public.search_cache
for update
to anon, authenticated
using (true)
with check (true);
