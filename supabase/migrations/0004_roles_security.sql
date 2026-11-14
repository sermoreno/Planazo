-- Planazo · 0004: roles (usuario, admin y admin principal) y revisión de seguridad.
-- Requiere 0001-0003. Se puede ejecutar más de una vez y no borra datos de nadie.
-- No contiene datos personales: el email del admin principal se configura aparte (README → "Administrador principal").

-- =====================================================================
-- 1. Esquema privado: la API de datos no lo expone (solo lo usan funciones seguras).
-- =====================================================================
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
revoke all on private.settings from public, anon, authenticated;

-- =====================================================================
-- 2. Roles: 'user' (por defecto), 'admin' y 'owner' (admin principal, solo uno).
--    Nadie puede cambiarse el rol desde la app: solo con las funciones de admin de abajo.
-- =====================================================================
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin', 'owner'));
create unique index if not exists profiles_single_owner on public.profiles ((true)) where role = 'owner';

-- Perfiles que falten (cuentas creadas antes de que existiera el disparador de registro).
insert into public.profiles (id, display_name)
select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1)), 60)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Registro de acciones de administración (quién cambió qué y cuándo). Solo lo leen los admins.
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users on delete set null,
  action text not null,
  target_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin', 'owner'))
$$;

-- =====================================================================
-- 3. Registro de cuentas: nombre limitado a 60 caracteres (un nombre largo ya no rompe el alta).
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 60))
  on conflict (id) do nothing;
  return new;
end $$;

-- =====================================================================
-- 4. Admin principal: solo se asigna ejecutando a mano private.apply_principal_admin() en el SQL Editor,
--    a la cuenta cuyo email esté en private.settings y con ese email ya verificado.
--    Nada se asigna solo al registrarse, y si ya hay un admin principal no se le puede quitar el rol
--    (para cambiarlo hay que hacerlo a propósito desde el SQL Editor, ver README).
-- =====================================================================
create or replace function private.apply_principal_admin() returns void
language plpgsql security definer set search_path = '' as $$
declare target_email text; target uuid;
begin
  select lower(trim(value)) into target_email from private.settings where key = 'principal_admin_email';
  if coalesce(target_email, '') = '' then return; end if;
  select id into target from auth.users where lower(email) = target_email and email_confirmed_at is not null;
  if target is null then return; end if;
  if exists (select 1 from public.profiles where role = 'owner') then return; end if;
  insert into public.profiles (id, display_name, role) values (target, split_part(target_email, '@', 1), 'owner')
    on conflict (id) do update set role = 'owner';
  insert into public.admin_audit (actor_id, action, target_id) values (null, 'principal_admin', target);
end $$;

-- Versión anterior de este archivo: asignaba el rol sola al verificar el email. Se quita.
drop trigger if exists on_auth_user_role on auth.users;
drop function if exists private.on_auth_user_change();

-- =====================================================================
-- 5. Funciones de administración (comprueban el rol dentro; la app solo enseña el panel a admins).
-- =====================================================================
create or replace function public.admin_list_users()
returns table (id uuid, email text, display_name text, role text, plan_tier text, created_at timestamptz,
               last_sign_in_at timestamptz, email_confirmed boolean, saved_plans int, shared_plans int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
  select u.id, u.email::text, p.display_name, coalesce(p.role, 'user'), coalesce(p.plan_tier, 'free'), u.created_at,
         u.last_sign_in_at, u.email_confirmed_at is not null,
         (select count(*)::int from public.itineraries i where i.user_id = u.id and i.status = 'saved'),
         (select count(*)::int from public.itineraries i where i.user_id = u.id and i.is_public)
  from auth.users u left join public.profiles p on p.id = u.id
  order by u.created_at desc
  limit 1000;
end $$;

create or replace function public.admin_set_plan(target_user uuid, new_tier text) returns void
language plpgsql security definer set search_path = '' as $$
declare old_tier text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if new_tier is null or new_tier not in ('free', 'premium') then raise exception 'INVALID_VALUE' using errcode = '22023'; end if;
  select plan_tier into old_tier from public.profiles where id = target_user for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if old_tier is distinct from new_tier then
    update public.profiles set plan_tier = new_tier where id = target_user;
    insert into public.admin_audit (actor_id, action, target_id, detail)
    values (auth.uid(), 'set_plan', target_user, jsonb_build_object('from', old_tier, 'to', new_tier));
  end if;
end $$;

-- Solo el admin principal nombra o quita admins. Nadie puede cambiar su propio rol ni el del admin principal.
create or replace function public.admin_set_role(target_user uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare old_role text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('user', 'admin') then raise exception 'INVALID_VALUE' using errcode = '22023'; end if;
  if target_user = auth.uid() then raise exception 'CANNOT_CHANGE_SELF' using errcode = '42501'; end if;
  select role into old_role from public.profiles where id = target_user for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if old_role = 'owner' then raise exception 'CANNOT_CHANGE_OWNER' using errcode = '42501'; end if;
  if new_role = 'admin' and not exists (select 1 from auth.users where id = target_user and email_confirmed_at is not null) then
    raise exception 'EMAIL_NOT_CONFIRMED' using errcode = '42501';
  end if;
  if old_role is distinct from new_role then
    update public.profiles set role = new_role where id = target_user;
    insert into public.admin_audit (actor_id, action, target_id, detail)
    values (auth.uid(), 'set_role', target_user, jsonb_build_object('from', old_role, 'to', new_role));
  end if;
end $$;

-- Borrar mi cuenta: el admin principal no puede borrarse desde la app (se quedaría el proyecto sin dueño).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'OWNER_CANNOT_DELETE' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- =====================================================================
-- 6. Planes compartidos: antes cualquiera podía LISTAR todos los planes públicos (y el id de su autor).
--    Ahora solo se abre un plan sabiendo su enlace, y solo con los datos que enseña la página.
-- =====================================================================
create or replace function public.get_shared_plan(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'title', i.title, 'created_at', i.created_at, 'share_slug', i.share_slug,
    'day', coalesce(pr.constraints ->> 'day', 'sat'), 'budget', pr.budget_pp,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'place_id', it.place_id, 'position', it.position, 'day', it.day, 'start_time', it.start_time, 'end_time', it.end_time,
        'reason', it.reason, 'est_cost', it.est_cost, 'travel_min_from_prev', it.travel_min_from_prev, 'verify_note', it.verify_note
      ) order by it.position)
      from public.itinerary_items it where it.itinerary_id = i.id), '[]'::jsonb))
  from public.itineraries i
  left join public.preferences pr on pr.id = i.preference_id
  where i.share_slug = p_slug and i.is_public and i.status = 'saved'
$$;

-- =====================================================================
-- 7. Límites en servidor: plan Gratis (3 guardados; premium y admins sin límite) y topes anti-abuso.
-- =====================================================================
create or replace function public.enforce_free_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int; tier text; r text;
begin
  perform pg_advisory_xact_lock(hashtextextended('pz_itin:' || new.user_id::text, 0));
  if tg_op = 'INSERT' and (select count(*) from public.itineraries where user_id = new.user_id and id <> new.id) >= 200 then
    raise exception 'ROW_LIMIT' using hint = 'Máximo 200 planes por cuenta';
  end if;
  if new.status <> 'saved' then return new; end if;
  if exists (select 1 from public.itineraries where id = new.id and status = 'saved') then return new; end if;
  select plan_tier, role into tier, r from public.profiles where id = new.user_id;
  if coalesce(tier, 'free') <> 'free' or r in ('admin', 'owner') then return new; end if;
  select count(*) into n from public.itineraries where user_id = new.user_id and status = 'saved' and id <> new.id;
  if n >= 3 then raise exception 'FREE_LIMIT' using hint = 'Plan Gratis: máximo 3 planes guardados'; end if;
  return new;
end $$;
drop trigger if exists itineraries_free_limit on public.itineraries;
create trigger itineraries_free_limit before insert or update of status on public.itineraries
  for each row execute function public.enforce_free_limit();

create or replace function private.cap_preferences() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.preferences where user_id = new.user_id) >= 300 then
    raise exception 'ROW_LIMIT' using hint = 'Demasiadas preferencias guardadas';
  end if;
  return new;
end $$;
drop trigger if exists preferences_cap on public.preferences;
create trigger preferences_cap before insert on public.preferences for each row execute function private.cap_preferences();

create or replace function private.cap_items() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.itinerary_items where itinerary_id = new.itinerary_id) >= 60 then
    raise exception 'ROW_LIMIT' using hint = 'Máximo 60 paradas por plan';
  end if;
  return new;
end $$;
drop trigger if exists itinerary_items_cap on public.itinerary_items;
create trigger itinerary_items_cap before insert on public.itinerary_items for each row execute function private.cap_items();

-- Al borrar un plan (o al volver a guardarlo) se borran sus preferencias antiguas: no quedan datos sueltos.
create or replace function private.cleanup_preference() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.preference_id is not null and (tg_op = 'DELETE' or new.preference_id is distinct from old.preference_id) then
    delete from public.preferences p
    where p.id = old.preference_id and p.user_id = old.user_id
      and not exists (select 1 from public.itineraries i where i.preference_id = old.preference_id and i.id <> old.id);
  end if;
  return null;
end $$;
drop trigger if exists itineraries_cleanup_preference on public.itineraries;
create trigger itineraries_cleanup_preference after delete or update of preference_id on public.itineraries
  for each row execute function private.cleanup_preference();

-- Preferencias sueltas que ya existían (de planes re-guardados o borrados).
delete from public.preferences p where not exists (select 1 from public.itineraries i where i.preference_id = p.id);

-- =====================================================================
-- 8. Validación de datos (NOT VALID: se aplica a lo nuevo sin bloquear filas antiguas).
-- =====================================================================
alter table public.profiles drop constraint if exists profiles_home_city_len,
  add constraint profiles_home_city_len check (char_length(home_city) <= 60) not valid;

alter table public.itineraries
  drop constraint if exists itineraries_status_check,
  drop constraint if exists itineraries_title_len,
  drop constraint if exists itineraries_slug_format,
  drop constraint if exists itineraries_public_needs_slug,
  drop constraint if exists itineraries_cost_range,
  add constraint itineraries_status_check check (status in ('draft', 'saved')) not valid,
  add constraint itineraries_title_len check (char_length(title) <= 120) not valid,
  add constraint itineraries_slug_format check (share_slug ~ '^[a-z0-9]{6,40}$') not valid,
  add constraint itineraries_public_needs_slug check (not is_public or share_slug is not null) not valid,
  add constraint itineraries_cost_range check (total_cost between 0 and 100000) not valid;

alter table public.itinerary_items
  drop constraint if exists items_position_range,
  drop constraint if exists items_text_len,
  drop constraint if exists items_numbers_range,
  add constraint items_position_range check (position between 0 and 99) not valid,
  add constraint items_text_len check (char_length(reason) <= 500 and char_length(verify_note) <= 300) not valid,
  add constraint items_numbers_range check (est_cost between 0 and 10000 and travel_min_from_prev between 0 and 600) not valid;

alter table public.preferences
  drop constraint if exists preferences_text_len,
  drop constraint if exists preferences_numbers_range,
  add constraint preferences_text_len check (
    char_length(mood_text) <= 1000 and char_length(companions) <= 40 and char_length(pace) <= 40
    and cardinality(interests) <= 20 and pg_column_size(constraints) <= 4000) not valid,
  add constraint preferences_numbers_range check (budget_pp between 0 and 100000) not valid;

alter table public.chat_messages drop constraint if exists chat_content_len,
  add constraint chat_content_len check (char_length(content) <= 4000) not valid;

-- La caché de direcciones es compartida: solo admite búsquedas cortas y coordenadas dentro de la Comunidad de Madrid.
alter table public.geocode_cache
  drop constraint if exists geocode_query_len,
  drop constraint if exists geocode_in_madrid,
  add constraint geocode_query_len check (char_length(query) between 1 and 200) not valid,
  add constraint geocode_in_madrid check (lat between 39.8 and 41.2 and lng between -4.7 and -2.9) not valid;

create index if not exists preferences_user_idx on public.preferences (user_id);
create index if not exists itineraries_preference_idx on public.itineraries (preference_id);
create index if not exists chat_messages_itinerary_idx on public.chat_messages (itinerary_id);

-- =====================================================================
-- 9. Reglas RLS: se rehacen todas desde cero para que el estado sea conocido.
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.preferences enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.chat_messages enable row level security;
alter table public.geocode_cache enable row level security;
alter table public.admin_audit enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('profiles', 'places', 'preferences', 'itineraries', 'itinerary_items', 'chat_messages', 'geocode_cache', 'admin_audit')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Perfil: cada persona ve y edita solo el suyo (y solo nombre y ciudad, ver permisos abajo).
create policy "perfil: ver el mío" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "perfil: editar el mío" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Catálogo de sitios: lectura pública. Nadie lo modifica desde la app.
create policy "sitios: lectura pública" on public.places for select to anon, authenticated using (true);

-- Preferencias: solo las mías.
create policy "preferencias: ver las mías" on public.preferences for select to authenticated using (user_id = (select auth.uid()));
create policy "preferencias: crear las mías" on public.preferences for insert to authenticated with check (user_id = (select auth.uid()));

-- Planes: solo los míos, y solo enlazados a preferencias mías.
create policy "planes: ver los míos" on public.itineraries for select to authenticated using (user_id = (select auth.uid()));
create policy "planes: crear los míos" on public.itineraries for insert to authenticated with check (
  user_id = (select auth.uid())
  and (preference_id is null or exists (select 1 from public.preferences p where p.id = preference_id and p.user_id = (select auth.uid()))));
create policy "planes: editar los míos" on public.itineraries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (preference_id is null or exists (select 1 from public.preferences p where p.id = preference_id and p.user_id = (select auth.uid()))));
create policy "planes: borrar los míos" on public.itineraries for delete to authenticated using (user_id = (select auth.uid()));

-- Paradas: solo las de mis planes.
create policy "paradas: ver las mías" on public.itinerary_items for select to authenticated
  using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = (select auth.uid())));
create policy "paradas: crear en mis planes" on public.itinerary_items for insert to authenticated
  with check (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = (select auth.uid())));
create policy "paradas: borrar de mis planes" on public.itinerary_items for delete to authenticated
  using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = (select auth.uid())));

-- Chat: la app no lo usa todavía. RLS activado y sin reglas = nadie entra.

-- Caché de direcciones: lectura pública; añadir solo con sesión (no se puede editar ni borrar lo de otros).
create policy "geocache: lectura" on public.geocode_cache for select to anon, authenticated using (true);
create policy "geocache: añadir con sesión" on public.geocode_cache for insert to authenticated with check (true);

-- Auditoría: solo admins.
create policy "auditoría: solo admins" on public.admin_audit for select to authenticated using ((select public.is_admin()));

-- =====================================================================
-- 10. Permisos de la API de datos: se quitan todos y se dan solo los que usa la app.
-- =====================================================================
revoke all on public.profiles, public.places, public.preferences, public.itineraries, public.itinerary_items,
  public.chat_messages, public.geocode_cache, public.admin_audit from anon, authenticated;
revoke all on sequence public.admin_audit_id_seq from anon, authenticated;

grant select on public.places, public.geocode_cache to anon, authenticated;
grant insert on public.geocode_cache to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, home_city) on public.profiles to authenticated;
grant select, insert on public.preferences to authenticated;
grant select, insert, update, delete on public.itineraries to authenticated;
grant select, insert, delete on public.itinerary_items to authenticated;
grant select on public.admin_audit to authenticated;

-- Funciones: nadie las ejecuta salvo las que la app necesita.
revoke all on function public.handle_new_user(), public.enforce_free_limit(), public.is_admin(), public.admin_list_users(),
  public.admin_set_plan(uuid, text), public.admin_set_role(uuid, text), public.delete_my_account(), public.get_shared_plan(text)
  from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function public.get_shared_plan(text) to anon, authenticated;
grant execute on function public.is_admin(), public.delete_my_account(), public.admin_list_users(),
  public.admin_set_plan(uuid, text), public.admin_set_role(uuid, text) to authenticated;

-- Si el email del admin principal ya está configurado, se aplica ahora.
select private.apply_principal_admin();
