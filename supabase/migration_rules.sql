-- DWSKnockout rules migration — run in Supabase SQL Editor
-- Supports: random team assignment for missed picks

alter table public.picks
  add column if not exists auto_assigned boolean not null default false;
