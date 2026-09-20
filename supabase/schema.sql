-- Goals Tracker — cloud data sync schema (v9)
--
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query),
-- after VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set up per the README's "Accounts setup".
--
-- Design: every local table (tasks, days, goals, habits, ...) is stored as JSON rows in this one
-- generic table, partitioned by `table_name`. This mirrors the exact shape already used by the
-- app's local-first IndexedDB store, so no per-model column mapping is needed and the schema
-- doesn't need to change every time a model gains a field.
create table if not exists public.records (
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, table_name, id)
);

create index if not exists records_user_table_idx on public.records (user_id, table_name);

alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
create policy "records_select_own" on public.records
  for select using (auth.uid() = user_id);

drop policy if exists "records_insert_own" on public.records;
create policy "records_insert_own" on public.records
  for insert with check (auth.uid() = user_id);

drop policy if exists "records_update_own" on public.records;
create policy "records_update_own" on public.records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "records_delete_own" on public.records;
create policy "records_delete_own" on public.records
  for delete using (auth.uid() = user_id);

-- Enables live cross-device/cross-tab updates (Supabase Realtime).
alter publication supabase_realtime add table public.records;
