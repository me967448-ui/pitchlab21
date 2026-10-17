-- PitchLab 21 normalized PostgreSQL schema for an authorized PES 2021 dataset.
-- Run in a fresh Supabase project's SQL editor. The separate bundled app sample is source-linked; import rows through a controlled data workflow.
-- Public roles may read reference data; only trusted server/admin imports should write.

create extension if not exists pgcrypto;

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  source_name text,
  source_version text,
  source_url text,
  license_notes text,
  is_active boolean not null default false,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists datasets_one_active_idx on public.datasets (is_active) where is_active = true;

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  name text not null,
  region text,
  unique(dataset_id, name),
  unique(id, dataset_id)
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  league_id uuid,
  name text not null,
  short_name text,
  badge_url text,
  is_national_team boolean not null default false,
  foreign key (league_id) references public.leagues(id) on delete set null,
  unique(dataset_id, name),
  unique(id, dataset_id)
);

create table if not exists public.nationalities (
  code text primary key,
  name text not null unique,
  flag_emoji text
);

-- Coach records and tactical presets are stored separately from player rows.
-- Use source_url/source_notes and NULL for values the source does not publish.
create table if not exists public.managers (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  display_name text not null,
  real_name text,
  game_name text,
  nationality_code text references public.nationalities(code) on delete set null,
  adaptability integer check (adaptability is null or adaptability between 1 and 99),
  management_skills integer check (management_skills is null or management_skills >= 0),
  game_rating integer check (game_rating is null or game_rating between 1 and 99),
  formation text,
  source_url text,
  source_label text,
  data_status text not null default 'SOURCE_LINKED',
  source_notes text,
  created_at timestamptz not null default now(),
  unique(dataset_id, game_name, display_name)
);

create table if not exists public.manager_tactics (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.managers(id) on delete cascade,
  tactical_slot text not null default 'default',
  attacking_style text,
  build_up text,
  attacking_area text,
  positioning text,
  support_range integer check (support_range is null or support_range between 1 and 10),
  defensive_style text,
  containment_area text,
  pressuring text,
  defensive_line integer check (defensive_line is null or defensive_line between 1 and 10),
  compactness integer check (compactness is null or compactness between 1 and 10),
  advanced_instructions jsonb not null default '[]'::jsonb,
  source_url text,
  source_notes text,
  updated_at timestamptz not null default now(),
  unique(manager_id, tactical_slot)
);

create table if not exists public.team_tactics (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  club_id uuid,
  manager_id uuid not null references public.managers(id) on delete cascade,
  tactics_id uuid not null references public.manager_tactics(id) on delete cascade,
  team_name text not null,
  formation text,
  source_url text,
  source_notes text,
  created_at timestamptz not null default now(),
  foreign key (club_id) references public.clubs(id) on delete set null,
  unique(dataset_id, team_name, manager_id, tactics_id)
);

create index if not exists managers_dataset_rating_idx on public.managers(dataset_id, game_rating desc);
create index if not exists managers_name_idx on public.managers using gin (to_tsvector('simple', coalesce(display_name,'') || ' ' || coalesce(real_name,'') || ' ' || coalesce(game_name,'')));
create index if not exists team_tactics_dataset_team_idx on public.team_tactics(dataset_id, team_name);

create table if not exists public.positions (
  code text primary key,
  label text not null
);

insert into public.positions(code,label) values
('GK','Goalkeeper'),('CB','Centre Back'),('LB','Left Back'),('RB','Right Back'),
('DMF','Defensive Midfielder'),('CMF','Central Midfielder'),('LMF','Left Midfielder'),
('RMF','Right Midfielder'),('AMF','Attacking Midfielder'),('LWF','Left Wing Forward'),
('RWF','Right Wing Forward'),('SS','Second Striker'),('CF','Centre Forward')
on conflict (code) do nothing;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  external_id text,
  full_name text not null,
  display_name text,
  club_id uuid,
  nationality_code text references public.nationalities(code),
  primary_position text not null references public.positions(code),
  overall smallint check (overall between 0 and 120),
  potential smallint check (potential between 0 and 120),
  age smallint check (age between 0 and 100),
  height_cm smallint check (height_cm between 0 and 260),
  weight_kg smallint check (weight_kg between 0 and 300),
  stronger_foot text check (stronger_foot in ('Right','Left','Both') or stronger_foot is null),
  playing_style text,
  weak_foot_usage smallint check (weak_foot_usage between 0 and 10),
  weak_foot_accuracy smallint check (weak_foot_accuracy between 0 and 10),
  form_rating smallint check (form_rating between 0 and 10),
  injury_resistance smallint check (injury_resistance between 0 and 10),
  portrait_url text,
  record_status text not null default 'imported' check (record_status in ('official-source','community-source','demo','imported')),
  source_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (club_id) references public.clubs(id) on delete set null,
  unique(dataset_id, external_id)
);

-- Full attributes are nullable: null means unavailable, not a rating of zero.
create table if not exists public.player_attributes (
  player_id uuid primary key references public.players(id) on delete cascade,
  offensive_awareness smallint check (offensive_awareness between 0 and 120),
  ball_control smallint check (ball_control between 0 and 120),
  dribbling smallint check (dribbling between 0 and 120),
  tight_possession smallint check (tight_possession between 0 and 120),
  low_pass smallint check (low_pass between 0 and 120),
  lofted_pass smallint check (lofted_pass between 0 and 120),
  finishing smallint check (finishing between 0 and 120),
  heading smallint check (heading between 0 and 120),
  place_kicking smallint check (place_kicking between 0 and 120),
  curl smallint check (curl between 0 and 120),
  speed smallint check (speed between 0 and 120),
  acceleration smallint check (acceleration between 0 and 120),
  kicking_power smallint check (kicking_power between 0 and 120),
  jump smallint check (jump between 0 and 120),
  physical_contact smallint check (physical_contact between 0 and 120),
  balance smallint check (balance between 0 and 120),
  stamina smallint check (stamina between 0 and 120),
  defensive_awareness smallint check (defensive_awareness between 0 and 120),
  ball_winning smallint check (ball_winning between 0 and 120),
  aggression smallint check (aggression between 0 and 120),
  gk_awareness smallint check (gk_awareness between 0 and 120),
  gk_catching smallint check (gk_catching between 0 and 120),
  gk_clearing smallint check (gk_clearing between 0 and 120),
  gk_reflexes smallint check (gk_reflexes between 0 and 120),
  gk_reach smallint check (gk_reach between 0 and 120)
);

create table if not exists public.secondary_positions (
  player_id uuid not null references public.players(id) on delete cascade,
  position_code text not null references public.positions(code),
  primary key(player_id, position_code)
);

create table if not exists public.player_skills (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  name text not null,
  unique(dataset_id, name),
  unique(id, dataset_id)
);

create table if not exists public.player_skill_map (
  player_id uuid not null references public.players(id) on delete cascade,
  skill_id uuid not null references public.player_skills(id) on delete cascade,
  primary key(player_id, skill_id)
);

create table if not exists public.com_playing_styles (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  name text not null,
  unique(dataset_id, name),
  unique(id, dataset_id)
);

create table if not exists public.player_com_style_map (
  player_id uuid not null references public.players(id) on delete cascade,
  style_id uuid not null references public.com_playing_styles(id) on delete cascade,
  primary key(player_id, style_id)
);

create index if not exists players_dataset_idx on public.players(dataset_id);
create index if not exists players_name_search_idx on public.players using gin (to_tsvector('simple', coalesce(display_name, full_name)));
create index if not exists players_position_rating_idx on public.players(dataset_id, primary_position, overall desc);
create index if not exists players_club_idx on public.players(dataset_id, club_id);
create index if not exists players_nationality_idx on public.players(nationality_code);
create index if not exists players_age_idx on public.players(dataset_id, age);
create index if not exists players_potential_idx on public.players(dataset_id, potential desc);
create index if not exists player_attributes_speed_idx on public.player_attributes(speed);
create index if not exists player_attributes_low_pass_idx on public.player_attributes(low_pass);

-- A stable view for the active dataset. The actual app/server should paginate this view.
create or replace view public.active_players as
select p.*, d.label as dataset_label, d.source_name as dataset_source,
       c.name as club_name, l.name as league_name, n.name as nationality_name
from public.players p
join public.datasets d on d.id = p.dataset_id and d.is_active = true
left join public.clubs c on c.id = p.club_id and c.dataset_id = p.dataset_id
left join public.leagues l on l.id = c.league_id and l.dataset_id = p.dataset_id
left join public.nationalities n on n.code = p.nationality_code;

-- Read-only public lookup access. Do not add anon/authenticated write policies for game data.
alter table public.datasets enable row level security;
alter table public.leagues enable row level security;
alter table public.clubs enable row level security;
alter table public.nationalities enable row level security;
alter table public.managers enable row level security;
alter table public.manager_tactics enable row level security;
alter table public.team_tactics enable row level security;
alter table public.positions enable row level security;
alter table public.players enable row level security;
alter table public.player_attributes enable row level security;
alter table public.secondary_positions enable row level security;
alter table public.player_skills enable row level security;
alter table public.player_skill_map enable row level security;
alter table public.com_playing_styles enable row level security;
alter table public.player_com_style_map enable row level security;

do $$ begin
  create policy "public read datasets" on public.datasets for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read leagues" on public.leagues for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read clubs" on public.clubs for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read nationalities" on public.nationalities for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read managers" on public.managers for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read manager tactics" on public.manager_tactics for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read team tactics" on public.team_tactics for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read positions" on public.positions for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read players" on public.players for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read player attributes" on public.player_attributes for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read secondary positions" on public.secondary_positions for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read skills" on public.player_skills for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read skill maps" on public.player_skill_map for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read COM styles" on public.com_playing_styles for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read COM style maps" on public.player_com_style_map for select using (true);
exception when duplicate_object then null; end $$;

-- Writes are intentionally restricted to trusted server/admin tooling using a server-side key.
