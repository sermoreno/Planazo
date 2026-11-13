-- Planazo · esquema inicial (ciudad piloto: Madrid)
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  home_city text default 'Madrid',
  plan_tier text default 'free' check (plan_tier in ('free','premium')),
  created_at timestamptz default now()
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  address text,
  lat float8 not null,
  lng float8 not null,
  neighborhood text,
  price_level int check (price_level between 0 and 4),
  avg_cost_eur numeric,
  avg_duration_min int,
  opening_hours jsonb,
  indoor bool default false,
  tags text[] default '{}',
  external_url text,
  is_verified bool default false
);

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  date_range daterange,
  companions text,
  budget_pp numeric,
  pace text,
  interests text[],
  mood_text text,
  constraints jsonb,
  created_at timestamptz default now()
);

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  preference_id uuid references public.preferences on delete set null,
  title text,
  plan_date date,
  total_cost numeric,
  status text default 'draft',
  share_slug text unique,
  is_public bool default false,
  created_at timestamptz default now()
);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries on delete cascade,
  place_id uuid references public.places,
  position int not null,
  day text default 'sat' check (day in ('sat','sun')), -- extensión: permite planes de sábado y domingo
  start_time time,
  end_time time,
  reason text,
  est_cost numeric,
  travel_min_from_prev int,
  verify_note text
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references public.itineraries on delete cascade,
  role text check (role in ('user','assistant')),
  content text,
  created_at timestamptz default now()
);

create table public.geocode_cache (
  query text primary key,
  lat float8,
  lng float8,
  updated_at timestamptz default now()
);

create index on public.itinerary_items (itinerary_id, position);
create index on public.itineraries (user_id);

-- Perfil automático al registrarse
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.preferences enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.chat_messages enable row level security;
alter table public.geocode_cache enable row level security;

create policy "perfil propio" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "places lectura pública" on public.places for select using (true);

create policy "preferencias propias" on public.preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "itinerarios propios" on public.itineraries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "itinerarios públicos por enlace" on public.itineraries for select
  using (is_public = true and share_slug is not null);

create policy "paradas de mis itinerarios" on public.itinerary_items for all
  using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = auth.uid()));
create policy "paradas de itinerarios públicos" on public.itinerary_items for select
  using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.is_public = true));

create policy "chat de mis itinerarios" on public.chat_messages for all
  using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = auth.uid()));

create policy "geocache lectura" on public.geocode_cache for select using (true);
create policy "geocache escritura autenticados" on public.geocode_cache for insert to authenticated with check (true);

-- Límite freemium: 3 planes guardados en Gratis (se aplica también en servidor)
create function public.enforce_free_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; tier text;
begin
  select plan_tier into tier from public.profiles where id = new.user_id;
  select count(*) into n from public.itineraries where user_id = new.user_id and status = 'saved';
  if coalesce(tier,'free') = 'free' and new.status = 'saved' and n >= 3 then
    raise exception 'FREE_LIMIT' using hint = 'Plan Gratis: máximo 3 planes guardados';
  end if;
  return new;
end $$;
create trigger itineraries_free_limit before insert on public.itineraries
  for each row execute function public.enforce_free_limit();
