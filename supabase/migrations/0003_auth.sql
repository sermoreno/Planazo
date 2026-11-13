-- Planazo · cuentas con email y contraseña: perfil protegido, borrado de cuenta y límite gratuito corregido.
-- Se puede ejecutar más de una vez.

-- 1) Perfil al registrarse: guarda el nombre que la persona escribe en el registro.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

-- 2) Perfil: cada persona solo lee su perfil y solo puede cambiar su nombre y su ciudad.
--    plan_tier (gratis/premium) ya no se puede modificar desde la app: solo desde el servidor.
drop policy if exists "perfil propio" on public.profiles;
drop policy if exists "perfil propio lectura" on public.profiles;
drop policy if exists "perfil propio edición" on public.profiles;
create policy "perfil propio lectura" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "perfil propio edición" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, home_city) on public.profiles to authenticated;
alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len check (char_length(display_name) <= 60);

-- 3) Datos personales nunca visibles sin sesión (los planes compartidos siguen siendo públicos por enlace).
revoke all on public.preferences, public.chat_messages from anon;
revoke insert, update, delete on public.itineraries, public.itinerary_items, public.places, public.geocode_cache from anon;
revoke insert, update, delete on public.places from authenticated;

-- 4) Límite gratuito: contar solo planes nuevos (editar un plan ya guardado no debe chocar con el límite).
create or replace function public.enforce_free_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; tier text;
begin
  if new.status <> 'saved' then return new; end if;
  if exists (select 1 from public.itineraries where id = new.id and status = 'saved') then return new; end if;
  select plan_tier into tier from public.profiles where id = new.user_id;
  select count(*) into n from public.itineraries where user_id = new.user_id and status = 'saved' and id <> new.id;
  if coalesce(tier, 'free') = 'free' and n >= 3 then
    raise exception 'FREE_LIMIT' using hint = 'Plan Gratis: máximo 3 planes guardados';
  end if;
  return new;
end $$;
drop trigger if exists itineraries_free_limit on public.itineraries;
create trigger itineraries_free_limit before insert or update of status on public.itineraries
  for each row execute function public.enforce_free_limit();

-- 5) Borrar mi cuenta: elimina el usuario y, en cascada, su perfil, preferencias y planes.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
