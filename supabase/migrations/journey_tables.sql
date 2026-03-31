-- Single Player Journey tables
-- Run this in the Supabase SQL editor

create table if not exists cpu_opponents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  is_boss boolean not null default false,
  coins_reward integer not null default 1,
  stage_order integer not null default 999,
  section integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists user_journey_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed_opponent_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Allow anyone to read opponents (used by journey page)
alter table cpu_opponents enable row level security;
create policy "Anyone can read cpu_opponents" on cpu_opponents
  for select using (true);

-- Only service role can insert/update/delete (handled via admin API routes)
-- No additional RLS policies needed for mutations since we use the admin client

-- Users can only read/write their own progress
alter table user_journey_progress enable row level security;
create policy "Users can read own progress" on user_journey_progress
  for select using (auth.uid() = user_id);
create policy "Users can upsert own progress" on user_journey_progress
  for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on user_journey_progress
  for update using (auth.uid() = user_id);
