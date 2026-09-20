-- Goals Tracker — Spotify Focus Integration schema (v11, Epic 59)
--
-- Run this once in your Supabase project's SQL Editor, after schema.sql and after you've set up
-- accounts (Supabase Auth). See the README's "Spotify Focus Integration setup" section for the
-- full setup flow (Spotify app registration, Edge Function deploy, secrets).
--
-- Design: refresh_token and access_token are the sensitive columns here — a refresh token is a
-- long-lived credential that can mint new access tokens indefinitely, so it must never reach the
-- browser. This table has NO row-level-security policies granted to the `anon` or `authenticated`
-- roles at all: with RLS enabled and zero policies, Postgres denies every row to those roles by
-- default. Only the `supabase-spotify-*` Edge Functions can read or write this table, because they
-- use the project's service-role key, which bypasses RLS entirely. The client never queries this
-- table directly — it only ever calls the Edge Functions (spotify-status/-start/-token/-disconnect),
-- which return just what the UI needs (connected boolean, display name) and never the tokens.
create table if not exists public.spotify_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spotify_user_id text not null,
  spotify_display_name text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text not null,
  connected_at timestamptz not null default now()
);

alter table public.spotify_connections enable row level security;
-- Intentionally no policies: see the design note above.
