-- Planazo · instalación completa en Supabase (pegar entero en SQL Editor y pulsar Run).

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


-- Permisos explícitos para la API de datos (las reglas RLS siguen decidiendo qué filas ve cada uno).
grant usage on schema public to anon, authenticated;
grant select on public.places, public.geocode_cache to anon, authenticated;
grant insert on public.geocode_cache to authenticated;
grant select on public.itineraries, public.itinerary_items to anon;
grant select, insert, update, delete on public.profiles, public.preferences, public.itineraries, public.itinerary_items, public.chat_messages to authenticated;


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


-- Seed generado por scripts/gen-seed.mjs: 84 lugares reales de Madrid (is_verified = false).
insert into public.places (id,name,category,description,address,lat,lng,neighborhood,price_level,avg_cost_eur,avg_duration_min,opening_hours,indoor,tags,external_url,is_verified) values
('4d195b17-6b93-5b5c-a87f-204c51295f63','Parque del Retiro','parque','El gran pulmón verde del centro: paseos, estanque y rincones para desconectar.','Plaza de la Independencia, 7',40.4153,-3.6845,'Retiro',0,0,90,'{"sat":["06:00","22:00"],"sun":["06:00","22:00"]}'::jsonb,false,array['naturaleza','tranquilo','familia','pareja']::text[],'https://www.esmadrid.com/informacion-turistica/parque-del-retiro',false),
('97b5fefd-5a8f-5122-afbc-90a141296c1b','Palacio de Cristal','parque','Pabellón de hierro y vidrio junto a un lago, con instalaciones de arte contemporáneo.','Paseo de Cuba, 4 (Parque del Retiro)',40.4136,-3.6826,'Retiro',0,0,30,'{"sat":["10:00","18:00"],"sun":["10:00","18:00"]}'::jsonb,true,array['cultura','naturaleza','tranquilo','pareja']::text[],'https://www.museoreinasofia.es/visita/palacio-cristal',false),
('d7d4fc8e-aa9c-54ca-a221-e27e5f3fd3bf','Templo de Debod','mirador','Templo egipcio en un parque con uno de los mejores atardeceres de Madrid.','Calle Ferraz, 1',40.424,-3.7178,'Argüelles',0,0,45,'{"sat":["07:00","23:00"],"sun":["07:00","23:00"]}'::jsonb,false,array['cultura','naturaleza','atardecer','pareja','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Templo%20de%20Debod%2C%20Madrid',false),
('e71319d3-48e2-5bcb-afbf-cfd984eb50c6','Madrid Río','parque','Parque lineal junto al Manzanares para pasear, correr o ir en bici.','Puente de Segovia',40.4114,-3.72,'Arganzuela',0,0,75,'{"sat":["00:00","23:59"],"sun":["00:00","23:59"]}'::jsonb,false,array['naturaleza','deporte','familia','activo']::text[],'https://www.openstreetmap.org/search?query=Madrid%20R%C3%ADo%2C%20Madrid',false),
('4ac20db2-fead-5d5f-a7a8-8288348201df','Lago de la Casa de Campo','parque','Lago con vistas al skyline en el mayor parque de la ciudad.','Paseo de la Puerta del Ángel, 1',40.4196,-3.7383,'Casa de Campo',0,0,90,'{"sat":["07:00","22:00"],"sun":["07:00","22:00"]}'::jsonb,false,array['naturaleza','deporte','familia','amigos']::text[],'https://www.openstreetmap.org/search?query=Lago%20de%20la%20Casa%20de%20Campo%2C%20Madrid',false),
('95c3349c-6ac6-5506-ad33-0858e8b798d5','Rosaleda del Parque del Oeste','parque','Jardín de rosas con cientos de variedades, ideal para un paseo sin prisa.','Paseo del Pintor Rosales, 2',40.4278,-3.723,'Moncloa',0,0,45,'{"sat":["10:00","20:00"],"sun":["10:00","20:00"]}'::jsonb,false,array['naturaleza','tranquilo','pareja']::text[],'https://www.openstreetmap.org/search?query=Rosaleda%20Ram%C3%B3n%20Ortiz%2C%20Madrid',false),
('c6de165d-5f9c-533a-a55a-19864927f909','Real Jardín Botánico','parque','Jardín histórico del siglo XVIII con invernaderos y colecciones de plantas.','Plaza de Murillo, 2',40.4111,-3.6912,'Cortes',1,6,60,'{"sat":["10:00","18:00"],"sun":["10:00","18:00"]}'::jsonb,false,array['naturaleza','cultura','tranquilo','pareja']::text[],'https://www.rjb.csic.es',false),
('3f7b6087-107b-5fa3-a8c3-36f7c60da931','Parque El Capricho','parque','Jardín romántico abierto solo los fines de semana, con laberinto y templetes.','Paseo de la Alameda de Osuna, 25',40.4555,-3.5995,'Alameda de Osuna',0,0,90,'{"sat":["09:00","18:30"],"sun":["09:00","18:30"]}'::jsonb,false,array['naturaleza','tranquilo','pareja','fotogenico']::text[],'https://www.openstreetmap.org/search?query=Parque%20El%20Capricho%2C%20Madrid',false),
('07677651-db86-5725-ab69-492f9da97d13','Museo del Prado','museo','Velázquez, Goya y El Bosco en una de las pinacotecas más importantes del mundo.','Calle de Ruiz de Alarcón, 23',40.4138,-3.6921,'Cortes',2,15,120,'{"sat":["10:00","20:00"],"sun":["10:00","19:00"]}'::jsonb,true,array['cultura','lluvia','pareja','solo']::text[],'https://www.museodelprado.es',false),
('fa74b4ed-8b86-5ef2-a963-bfcf3f7bd59e','Museo Reina Sofía','museo','Arte moderno y contemporáneo, con el Guernica de Picasso como gran icono.','Calle de Santa Isabel, 52',40.408,-3.6943,'Embajadores',2,12,105,'{"sat":["10:00","21:00"],"sun":["10:00","14:30"]}'::jsonb,true,array['cultura','lluvia','solo','amigos']::text[],'https://www.museoreinasofia.es',false),
('813f9eb8-44d8-502e-adcc-08acf2567f8e','Museo Thyssen-Bornemisza','museo','Un recorrido por ocho siglos de pintura europea en un palacio del Paseo del Prado.','Paseo del Prado, 8',40.416,-3.6948,'Cortes',2,14,105,'{"sat":["10:00","19:00"],"sun":["10:00","19:00"]}'::jsonb,true,array['cultura','lluvia','pareja','solo']::text[],'https://www.museothyssen.org',false),
('3e4688c1-ae77-51ef-a06a-8354074e1e57','Palacio Real','museo','Residencia oficial de la Corona con salones históricos y la Armería Real.','Calle de Bailén, s/n',40.418,-3.7143,'Palacio',2,14,90,'{"sat":["10:00","18:00"],"sun":["10:00","18:00"]}'::jsonb,true,array['cultura','lluvia','familia']::text[],'https://www.patrimonionacional.es',false),
('95952825-7b31-5168-a1f5-7d86be1f4efb','Museo Sorolla','museo','La casa-taller del pintor de la luz, con un jardín andaluz precioso.','Paseo del General Martínez Campos, 37',40.4355,-3.6925,'Chamberí',1,3,60,'{"sat":["09:30","20:00"],"sun":["10:00","15:00"]}'::jsonb,true,array['cultura','tranquilo','lluvia','pareja']::text[],'https://www.openstreetmap.org/search?query=Museo%20Sorolla%2C%20Madrid',false),
('a542c9a5-36b1-5bab-a395-0fbed4e841f1','CaixaForum Madrid','museo','Exposiciones temporales bajo el famoso jardín vertical.','Paseo del Prado, 36',40.4111,-3.6935,'Cortes',1,6,75,'{"sat":["10:00","20:00"],"sun":["10:00","20:00"]}'::jsonb,true,array['cultura','lluvia','amigos']::text[],'https://caixaforum.org/es/madrid',false),
('969f3435-97be-5e8b-a943-97541abe21e6','Matadero Madrid','centro cultural','Antiguo matadero convertido en centro de creación con cine, teatro y exposiciones.','Plaza de Legazpi, 8',40.392,-3.6975,'Arganzuela',0,0,75,'{"sat":["10:00","22:00"],"sun":["10:00","22:00"]}'::jsonb,true,array['cultura','amigos','lluvia','alternativo']::text[],'https://www.mataderomadrid.org',false),
('e9895fcb-5bd2-52a0-a80c-8aa27e121a1e','Museo Lázaro Galdiano','museo','Palacete con una colección íntima de arte y objetos de lujo.','Calle de Serrano, 122',40.4369,-3.687,'Salamanca',1,7,75,'{"sat":["09:30","15:00"],"sun":["10:00","15:00"]}'::jsonb,true,array['cultura','tranquilo','lluvia']::text[],'https://www.flg.es',false),
('5e3030de-18f3-5b8c-a09d-c34e373c8124','Museo Arqueológico Nacional','museo','De la prehistoria a la Edad Moderna, con la Dama de Elche.','Calle de Serrano, 13',40.4237,-3.6893,'Recoletos',1,3,90,'{"sat":["09:30","20:00"],"sun":["09:30","15:00"]}'::jsonb,true,array['cultura','familia','lluvia']::text[],'https://www.man.es',false),
('4011cac1-97b7-5e2d-a5bb-33d108d33d44','Plaza Mayor','paseo','La plaza porticada del Madrid de los Austrias, punto de partida perfecto.','Plaza Mayor',40.4155,-3.7074,'Sol',0,0,30,'{"sat":["00:00","23:59"],"sun":["00:00","23:59"]}'::jsonb,false,array['cultura','familia','amigos']::text[],'https://www.openstreetmap.org/search?query=Plaza%20Mayor%2C%20Madrid',false),
('38151d58-6143-54bc-a696-8b4a8a62bd77','Azotea del Círculo de Bellas Artes','mirador','Vistas de 360º sobre la Gran Vía y Cibeles desde una azotea con terraza.','Calle de Alcalá, 42',40.4183,-3.6967,'Centro',1,5,45,'{"sat":["09:00","23:59"],"sun":["09:00","23:59"]}'::jsonb,false,array['cultura','nocturno','atardecer','pareja','amigos']::text[],'https://www.circulobellasartes.com',false),
('f4da0c8c-402e-5337-abc9-5fcf133faba9','Faro de Moncloa','mirador','Mirador acristalado a 92 metros con vistas hasta la sierra.','Avenida de los Reyes Católicos, s/n',40.4372,-3.7228,'Moncloa',1,4,40,'{"sat":["09:30","20:00"],"sun":["09:30","20:00"]}'::jsonb,true,array['cultura','familia','lluvia','fotogenico']::text[],'https://www.openstreetmap.org/search?query=Faro%20de%20Moncloa%2C%20Madrid',false),
('0aade165-a1aa-5ab4-ab3c-0ce9e50a090f','Cerro del Tío Pío','mirador','Colinas con una panorámica del skyline muy popular al atardecer.','Calle de Benjamín Palencia, 2',40.3954,-3.6507,'Vallecas',0,0,60,'{"sat":["00:00","23:59"],"sun":["00:00","23:59"]}'::jsonb,false,array['naturaleza','atardecer','amigos','alternativo']::text[],'https://www.openstreetmap.org/search?query=Parque%20Cerro%20del%20T%C3%ADo%20P%C3%ADo%2C%20Madrid',false),
('0af6c820-eda8-5cb0-a574-5e6d5da7f0e5','Mercado de San Miguel','mercado','Mercado de hierro de 1916 con puestos gourmet para picar de todo.','Plaza de San Miguel, s/n',40.4153,-3.709,'Sol',3,22,60,'{"sat":["10:00","23:59"],"sun":["10:00","23:59"]}'::jsonb,true,array['gastronomia','mercadillos','amigos','lluvia']::text[],'https://mercadodesanmiguel.es',false),
('b16593fc-ad5c-54f4-a12e-69348788e0c1','Mercado de San Fernando','mercado','Mercado de barrio multicultural con barras, libros al peso y buen ambiente.','Calle de Embajadores, 41',40.4087,-3.702,'Lavapiés',1,12,60,'{"sat":["09:00","23:59"],"sun":["12:00","17:00"]}'::jsonb,true,array['gastronomia','mercadillos','amigos','alternativo','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20San%20Fernando%2C%20Madrid',false),
('04d8c015-2591-5239-afb2-3570f03de060','El Rastro','mercadillo','El mercadillo más famoso de Madrid, solo los domingos por la mañana.','Calle de la Ribera de Curtidores',40.4087,-3.7075,'La Latina',0,0,90,'{"sun":["09:00","15:00"]}'::jsonb,false,array['mercadillos','cultura','amigos']::text[],'https://www.openstreetmap.org/search?query=El%20Rastro%2C%20Madrid',false),
('e97fd04d-a6ec-52b4-a8f9-fc9dd33a155f','Mercado de Antón Martín','mercado','Puestos de toda la vida junto a barras de cocina japonesa, italiana o vegana.','Calle de Santa Isabel, 5',40.4122,-3.6985,'Lavapiés',1,12,50,'{"sat":["09:00","17:00"]}'::jsonb,true,array['gastronomia','mercadillos','lluvia','alternativo']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20Ant%C3%B3n%20Mart%C3%ADn%2C%20Madrid',false),
('a6128f5e-bef5-5633-a2c4-dc18579afd69','Mercado de Motores','mercadillo','Mercadillo de diseño y food trucks entre trenes antiguos (un fin de semana al mes).','Paseo de las Delicias, 61 (Museo del Ferrocarril)',40.3984,-3.6941,'Delicias',1,8,90,'{"sat":["11:00","22:00"],"sun":["11:00","22:00"]}'::jsonb,true,array['mercadillos','gastronomia','familia','amigos']::text[],'https://www.mercadodemotores.es',false),
('8597c3e9-c86d-560c-a9c2-47559c604c3e','Mercado de San Ildefonso','mercado','Street food market de tres plantas con terrazas en pleno Malasaña.','Calle de Fuencarral, 57',40.4232,-3.7022,'Malasaña',2,15,60,'{"sat":["12:00","23:59"],"sun":["12:00","23:59"]}'::jsonb,true,array['gastronomia','nocturno','amigos','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20San%20Ildefonso%2C%20Madrid',false),
('94af5864-e621-5563-a7a5-9bceea4675ef','Chocolatería San Ginés','cafetería','Chocolate con churros desde 1894, abierto hasta muy tarde.','Pasadizo de San Ginés, 5',40.417,-3.707,'Sol',1,6,30,'{"sat":["08:00","23:59"],"sun":["08:00","23:59"]}'::jsonb,true,array['gastronomia','familia','pareja','lluvia','nocturno']::text[],'https://chocolateriasangines.com',false),
('252da290-b94c-515d-af06-f0ca7e958f7e','Casa Lucio','restaurante','Templo de los huevos rotos en la Cava Baja, cocina castiza de siempre.','Calle de la Cava Baja, 35',40.412,-3.7095,'La Latina',3,45,90,'{"sat":["13:00","23:30"],"sun":["13:00","23:30"]}'::jsonb,true,array['gastronomia','familia','pareja','lluvia']::text[],'https://www.casalucio.es',false),
('687a982f-657b-5be9-ad88-da008295850b','Sobrino de Botín','restaurante','Considerado el restaurante más antiguo del mundo; cochinillo y cordero asado.','Calle de los Cuchilleros, 17',40.4142,-3.7081,'Sol',4,55,105,'{"sat":["13:00","23:30"],"sun":["13:00","23:30"]}'::jsonb,true,array['gastronomia','cultura','pareja','lluvia']::text[],'https://botin.es',false),
('b683e7a5-5621-5c4a-ab69-141c96477e05','Casa Labra','bar','Taberna centenaria famosa por sus croquetas y soldaditos de Pavía.','Calle de Tetuán, 12',40.4176,-3.705,'Sol',1,10,40,'{"sat":["11:00","23:00"],"sun":["11:00","23:00"]}'::jsonb,true,array['gastronomia','amigos','solo']::text[],'https://www.openstreetmap.org/search?query=Casa%20Labra%2C%20Madrid',false),
('d73b99a2-0276-5c41-aba5-b682e2e0a302','Casa Revuelta','bar','Barra clásica de tapas de bacalao rebozado junto a la Plaza Mayor.','Calle de Latoneros, 3',40.4141,-3.7083,'Sol',1,8,35,'{"sat":["10:30","16:00"],"sun":["10:30","16:00"]}'::jsonb,true,array['gastronomia','amigos','solo']::text[],'https://www.openstreetmap.org/search?query=Casa%20Revuelta%2C%20Madrid',false),
('5021b1b8-8dc9-5e24-a819-ef0f30786e59','Café Gijón','cafetería','Café literario de 1888 para una pausa con historia.','Paseo de Recoletos, 21',40.4219,-3.6925,'Recoletos',2,12,45,'{"sat":["08:00","23:59"],"sun":["08:00","23:59"]}'::jsonb,true,array['gastronomia','cultura','tranquilo','lluvia','solo']::text[],'https://cafegijon.com',false),
('9fed3931-0d78-5f90-a95e-7cccfe2b7c6c','Bodega de la Ardosa','bar','Taberna de 1892 con una de las tortillas más celebradas de la ciudad.','Calle de Colón, 13',40.4233,-3.7008,'Malasaña',1,12,50,'{"sat":["12:00","23:59"],"sun":["12:00","23:59"]}'::jsonb,true,array['gastronomia','nocturno','amigos']::text[],'https://www.openstreetmap.org/search?query=Bodega%20de%20la%20Ardosa%2C%20Madrid',false),
('574c5f90-83cb-5837-a064-e2b72c885863','La Venencia','bar','Bar de jerez detenido en el tiempo, sin fotos y con mucho encanto.','Calle de Echegaray, 7',40.4155,-3.6989,'Huertas',1,10,45,'{"sat":["13:00","23:59"],"sun":["13:00","23:59"]}'::jsonb,true,array['nocturno','gastronomia','pareja','amigos']::text[],'https://www.openstreetmap.org/search?query=La%20Venencia%2C%20Madrid',false),
('81a7c3b0-a9c1-5152-a8c1-b394fb42d2d2','Café Central','club de jazz','Club de jazz mítico con conciertos en directo cada noche.','Plaza del Ángel, 10',40.4146,-3.7014,'Huertas',2,20,90,'{"sat":["11:30","23:59"],"sun":["11:30","23:59"]}'::jsonb,true,array['nocturno','cultura','pareja','lluvia']::text[],'https://www.cafecentralmadrid.com',false),
('9301a3d3-cf02-5f78-a42d-6b17d24c9e43','Corral de la Morería','tablao','Tablao flamenco histórico con espectáculo cada noche.','Calle de la Morería, 17',40.4122,-3.7146,'La Latina',4,55,90,'{"sat":["18:00","23:59"],"sun":["18:00","23:59"]}'::jsonb,true,array['nocturno','cultura','pareja','lluvia']::text[],'https://www.corraldelamoreria.com',false),
('c4d4173e-8b17-5f62-ad77-b241ff448529','Barcas del Estanque del Retiro','deporte','Remar en el estanque frente al monumento a Alfonso XII.','Paseo de la Argentina (Estanque Grande)',40.4174,-3.6829,'Retiro',1,8,45,'{"sat":["10:00","19:00"],"sun":["10:00","19:00"]}'::jsonb,false,array['deporte','naturaleza','pareja','familia','activo']::text[],'https://www.openstreetmap.org/search?query=Estanque%20Grande%20del%20Retiro%2C%20Madrid',false),
('35a753a3-203a-5c17-aeed-d4e5e2cb0658','Parque Juan Carlos I','deporte','Gran parque con carril bici, ría y préstamo de bicis los fines de semana.','Avenida de Logroño, s/n',40.4637,-3.6108,'Barajas',0,0,90,'{"sat":["07:00","23:00"],"sun":["07:00","23:00"]}'::jsonb,false,array['deporte','naturaleza','familia','activo']::text[],'https://www.openstreetmap.org/search?query=Parque%20Juan%20Carlos%20I%2C%20Madrid',false),
('fd1b0927-a507-540f-a388-7e70d8808e65','Tour del Estadio Santiago Bernabéu','deporte','Visita al estadio renovado, vestuarios y museo del club.','Avenida de Concha Espina, 1',40.4531,-3.6883,'Chamartín',3,28,90,'{"sat":["10:00","19:00"],"sun":["10:00","19:00"]}'::jsonb,true,array['deporte','amigos','familia','lluvia']::text[],'https://www.realmadrid.com',false),
('e5cbe230-9d8f-50ae-abea-4582aa224c4b','Zoo Aquarium de Madrid','ocio','Zoo y acuario con delfinario y exhibición de aves; se come dentro del parque.','Casa de Campo, s/n',40.4086,-3.7625,'Casa de Campo',3,26,300,'{"sat":["10:30","18:00"],"sun":["10:30","18:00"]}'::jsonb,false,array['familia','niños','naturaleza','animales','dia-completo']::text[],'https://www.zoomadrid.com',false),
('022829d5-8638-57be-a696-47e55ca35e8b','Parque de Atracciones de Madrid','ocio','Montañas rusas, zona infantil Nickelodeon y espectáculos; con restaurantes dentro.','Casa de Campo, s/n',40.4128,-3.7508,'Casa de Campo',3,32,300,'{"sat":["12:00","19:00"],"sun":["12:00","19:00"]}'::jsonb,false,array['familia','niños','amigos','activo','dia-completo']::text[],'https://www.parquedeatracciones.es',false),
('5395c262-78c5-5e08-a974-1de1be64f902','Faunia','ocio','Parque de naturaleza con ecosistemas a cubierto: pingüinos, selva tropical y granja.','Avenida de las Comunidades, 28',40.3919,-3.6125,'Valdebernardo',3,25,300,'{"sat":["10:00","18:00"],"sun":["10:00","18:00"]}'::jsonb,true,array['familia','niños','naturaleza','animales','lluvia','dia-completo']::text[],'https://www.faunia.es',false),
('68b83b01-60cc-5d57-a94c-2fbb96d0efd5','Teleférico de Madrid','ocio','Cabinas sobre el Parque del Oeste hasta la Casa de Campo, con vistas del Palacio Real.','Paseo del Pintor Rosales, s/n',40.4265,-3.7205,'Argüelles',1,7,50,'{"sat":["12:00","19:00"],"sun":["12:00","19:00"]}'::jsonb,false,array['familia','niños','pareja','fotogenico','naturaleza']::text[],'https://www.openstreetmap.org/search?query=Telef%C3%A9rico%20de%20Madrid%2C%20Madrid',false),
('13b2a082-0b17-509f-a8a5-ce2ed16f23d6','Planetario de Madrid','museo','Proyecciones bajo la cúpula y exposiciones sobre el universo para todas las edades.','Avenida del Planetario, 16 (Parque Tierno Galván)',40.3926,-3.6838,'Arganzuela',1,4,75,'{"sat":["11:00","20:00"],"sun":["11:00","20:00"]}'::jsonb,true,array['familia','niños','cultura','lluvia']::text[],'https://www.planetmad.es',false),
('c4b20b7a-ded5-5212-a7fa-978b45f57088','Museo de Cera de Madrid','ocio','Más de 450 figuras de cera, simuladores y un tren del terror para los mayores.','Paseo de Recoletos, 41',40.4253,-3.6906,'Recoletos',3,22,75,'{"sat":["10:00","20:30"],"sun":["10:00","20:30"]}'::jsonb,true,array['familia','niños','lluvia','amigos']::text[],'https://www.openstreetmap.org/search?query=Museo%20de%20Cera%20de%20Madrid%2C%20Madrid',false),
('48128ddf-355e-569d-ab9c-cc5ac30ee043','Palacio de Hielo','deporte','Pista de patinaje sobre hielo cubierta, con alquiler de patines.','Calle de Silvano, 77',40.4632,-3.6371,'Hortaleza',2,12,90,'{"sat":["11:00","21:00"],"sun":["11:00","21:00"]}'::jsonb,true,array['familia','niños','amigos','activo','deporte','lluvia']::text[],'https://www.openstreetmap.org/search?query=Palacio%20de%20Hielo%2C%20Madrid',false),
('29a467c6-d2da-52cc-a983-6c81f263ba20','Tour del Estadio Metropolitano','deporte','Visita al estadio del Atlético de Madrid: vestuarios, banquillos y museo. Cambia en días de partido.','Avenida de Luis Aragonés, 4',40.4361,-3.5994,'San Blas',2,25,90,'{"sat":["10:00","18:00"],"sun":["10:00","18:00"]}'::jsonb,false,array['deporte','familia','niños','amigos']::text[],'https://www.openstreetmap.org/search?query=Estadio%20Metropolitano%2C%20Madrid',false),
('4c51e7f2-3d6c-5aee-a12c-6cb6d7e786d2','Museo Nacional de Ciencias Naturales','museo','Dinosaurios, minerales y la sala de biodiversidad; talleres familiares el fin de semana.','Calle de José Gutiérrez Abascal, 2',40.441,-3.6903,'Chamartín',1,7,120,'{"sat":["10:00","20:00"],"sun":["10:00","14:30"]}'::jsonb,true,array['familia','niños','cultura','naturaleza','lluvia']::text[],'https://www.mncn.csic.es',false),
('5e7695ad-94d8-5a75-ab85-fd965e18c9f1','Museo del Ferrocarril','museo','Locomotoras de vapor en la antigua estación de Delicias, con maquetas y tren de jardín.','Paseo de las Delicias, 61',40.3983,-3.6942,'Delicias',1,6,90,'{"sat":["10:00","15:00"],"sun":["10:00","15:00"]}'::jsonb,true,array['familia','niños','cultura','lluvia']::text[],'https://www.museodelferrocarril.org',false),
('bfeb3ebc-4f06-5beb-a69b-9163359068e6','Museo Naval','museo','Maquetas de barcos, mascarones y el primer mapa con América. Donativo voluntario.','Paseo del Prado, 3',40.4175,-3.6928,'Cortes',0,0,75,'{"sat":["10:00","19:00"],"sun":["10:00","15:00"]}'::jsonb,true,array['familia','niños','cultura','lluvia']::text[],'https://www.openstreetmap.org/search?query=Museo%20Naval%2C%20Madrid',false),
('d25d8aa7-1acb-5954-a617-6f9539cf969c','Museo de América','museo','Tesoros precolombinos, el códice Tro-Cortesiano y momias andinas. Gratis los domingos.','Avenida de los Reyes Católicos, 6',40.4381,-3.7221,'Moncloa',1,3,90,'{"sat":["09:30","15:00"],"sun":["10:00","15:00"]}'::jsonb,true,array['familia','cultura','lluvia','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Museo%20de%20Am%C3%A9rica%2C%20Madrid',false),
('b9c49275-c370-5068-aac0-768217c85cc0','Museo Nacional de Antropología','museo','Viaje por las culturas del mundo junto a Atocha, con piezas que sorprenden a los niños.','Calle de Alfonso XII, 68',40.4077,-3.689,'Retiro',1,3,60,'{"sat":["09:30","20:00"],"sun":["10:00","15:00"]}'::jsonb,true,array['familia','cultura','lluvia','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Museo%20Nacional%20de%20Antropolog%C3%ADa%2C%20Madrid',false),
('00d4fca9-164b-5825-a75e-e818cede9986','Museo del Aire','museo','Más de 150 aviones en hangares y al aire libre junto al aeródromo de Cuatro Vientos.','Autovía A-5, km 10,7',40.3659,-3.8038,'Cuatro Vientos',0,0,150,'{"sat":["10:00","14:00"],"sun":["10:00","14:00"]}'::jsonb,false,array['familia','niños','cultura']::text[],'https://www.openstreetmap.org/search?query=Museo%20de%20Aeron%C3%A1utica%20y%20Astron%C3%A1utica%2C%20Madrid',false),
('f8271a39-438c-556a-a88b-14bd5e8ee2d4','Museo Geominero','museo','Vitrinas centenarias llenas de minerales, fósiles y meteoritos. Gratis.','Calle de Ríos Rosas, 23',40.4427,-3.6996,'Chamberí',0,0,60,'{"sat":["10:00","14:00"],"sun":["10:00","14:00"]}'::jsonb,true,array['familia','niños','cultura','lluvia','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Museo%20Geominero%2C%20Madrid',false),
('c06c3f05-bbe7-50c1-a954-4bebb52bb260','Museo de Historia de Madrid','museo','La gran maqueta de Madrid de 1830 y la historia de la ciudad. Gratis.','Calle de Fuencarral, 78',40.4258,-3.7008,'Malasaña',0,0,75,'{"sat":["10:00","20:00"],"sun":["10:00","20:00"]}'::jsonb,true,array['familia','cultura','lluvia']::text[],'https://www.openstreetmap.org/search?query=Museo%20de%20Historia%20de%20Madrid%2C%20Madrid',false),
('01b8c370-8c30-5126-acb5-58282ecbd3f4','Museo de San Isidro','museo','Los orígenes de Madrid, con el pozo del milagro de San Isidro. Gratis y con talleres.','Plaza de San Andrés, 2',40.4122,-3.7109,'La Latina',0,0,45,'{"sat":["10:00","20:00"],"sun":["10:00","15:00"]}'::jsonb,true,array['familia','cultura','lluvia','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Museo%20de%20San%20Isidro%2C%20Madrid',false),
('1b14b877-a304-5e1d-a71a-22c9176c3e34','Museo Casa de la Moneda','museo','Monedas, billetes y sellos de todas las épocas, con talleres para niños. Gratis.','Calle del Doctor Esquerdo, 36',40.4229,-3.669,'Salamanca',0,0,75,'{"sat":["10:00","17:00"],"sun":["10:00","14:00"]}'::jsonb,true,array['familia','cultura','lluvia','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Museo%20Casa%20de%20la%20Moneda%2C%20Madrid',false),
('a51291cf-2029-591c-af71-e52166024bd8','Real Observatorio de Madrid','museo','Edificio de Villanueva con la réplica del gran telescopio de Herschel. Visitas guiadas con reserva.','Calle de Alfonso XII, 3',40.4084,-3.6876,'Retiro',1,5,75,'{"sat":["10:00","18:00"],"sun":["10:00","18:00"]}'::jsonb,true,array['familia','cultura','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Real%20Observatorio%20de%20Madrid%2C%20Madrid',false),
('a131d956-2aac-55b7-af19-b46ba98279a7','Mirador de CentroCentro','mirador','Vistas de Cibeles y la Gran Vía desde la torre del Palacio de Cibeles.','Plaza de Cibeles, 1',40.4186,-3.6917,'Cortes',1,3,45,'{"sat":["10:30","19:00"],"sun":["10:30","19:00"]}'::jsonb,true,array['familia','cultura','fotogenico','lluvia']::text[],'https://www.openstreetmap.org/search?query=CentroCentro%20Palacio%20de%20Cibeles%2C%20Madrid',false),
('4ee1259f-bd8d-5dbf-ade9-10c8add123c0','Parque Quinta de los Molinos','parque','Almendros en flor a final de invierno, molinos de viento y un estanque.','Calle de Alcalá, 527',40.4439,-3.6275,'San Blas',0,0,75,'{"sat":["07:00","22:00"],"sun":["07:00","22:00"]}'::jsonb,false,array['naturaleza','familia','tranquilo','fotogenico']::text[],'https://www.openstreetmap.org/search?query=Parque%20Quinta%20de%20los%20Molinos%2C%20Madrid',false),
('1c4c99ce-60da-53af-a3c9-4bbee9954298','Parque Enrique Tierno Galván','parque','Colinas con vistas, columpios y el Planetario; buen sitio para ver anochecer.','Calle de Meneses, 4',40.3936,-3.6854,'Arganzuela',0,0,60,'{"sat":["07:00","23:00"],"sun":["07:00","23:00"]}'::jsonb,false,array['naturaleza','familia','niños','activo','atardecer']::text[],'https://www.openstreetmap.org/search?query=Parque%20Enrique%20Tierno%20Galv%C3%A1n%2C%20Madrid',false),
('db4a72ac-693b-51f6-af6a-d6a098e78ec9','Campo del Moro','parque','Jardines bajo el Palacio Real con pavos reales sueltos y la fuente de las Conchas.','Paseo de la Virgen del Puerto, s/n',40.4182,-3.7191,'Palacio',0,0,60,'{"sat":["10:00","18:00"],"sun":["10:00","18:00"]}'::jsonb,false,array['naturaleza','familia','tranquilo','pareja','fotogenico']::text[],'https://www.openstreetmap.org/search?query=Campo%20del%20Moro%2C%20Madrid',false),
('30e21565-4a1d-50e2-a17d-781bc92d77d7','Jardines de Sabatini','parque','Jardín geométrico junto al Palacio Real; bonito al caer la tarde.','Calle de Bailén, 2',40.4202,-3.7139,'Palacio',0,0,30,'{"sat":["09:00","21:00"],"sun":["09:00","21:00"]}'::jsonb,false,array['naturaleza','familia','tranquilo','atardecer','fotogenico']::text[],'https://www.openstreetmap.org/search?query=Jardines%20de%20Sabatini%2C%20Madrid',false),
('4c3dad7e-0cbe-56fc-a907-8875e2505bea','Parque de la Dehesa de la Villa','parque','Pinar con merenderos y uno de los atardeceres más bonitos del norte de Madrid.','Calle de Francos Rodríguez, s/n',40.4575,-3.7196,'Dehesa de la Villa',0,0,75,'{"sat":["00:00","23:59"],"sun":["00:00","23:59"]}'::jsonb,false,array['naturaleza','familia','tranquilo','atardecer']::text[],'https://www.openstreetmap.org/search?query=Dehesa%20de%20la%20Villa%2C%20Madrid',false),
('58ab2e70-d9c8-5774-a4ea-70314f72ed83','Parque Forestal de Valdebebas','parque','Gran parque forestal con rutas en bici, lago y miradores hacia la sierra.','Avenida de las Fuerzas Armadas, s/n',40.4909,-3.6317,'Hortaleza',0,0,90,'{"sat":["07:00","22:00"],"sun":["07:00","22:00"]}'::jsonb,false,array['naturaleza','familia','deporte','activo']::text[],'https://www.openstreetmap.org/search?query=Parque%20Forestal%20de%20Valdebebas%2C%20Madrid',false),
('d29725a3-4c42-558d-ac5c-b33b1424100d','Parque de Berlín','parque','Parque de barrio con zona infantil, estanques y fragmentos del Muro de Berlín.','Avenida de Ramón y Cajal, 2',40.4504,-3.6758,'Chamartín',0,0,45,'{"sat":["00:00","23:59"],"sun":["00:00","23:59"]}'::jsonb,false,array['naturaleza','familia','niños','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Parque%20de%20Berl%C3%ADn%2C%20Madrid',false),
('bac21458-2c24-59c3-ac2b-f1202339e4f5','Parque Juan Pablo II','parque','Rosaleda, lagos y grandes áreas de juego para niños en Hortaleza.','Calle de Ayacucho, s/n',40.455,-3.6269,'Hortaleza',0,0,60,'{"sat":["07:00","23:00"],"sun":["07:00","23:00"]}'::jsonb,false,array['naturaleza','familia','niños','activo']::text[],'https://www.openstreetmap.org/search?query=Parque%20Juan%20Pablo%20II%2C%20Madrid',false),
('a578655d-93da-5f67-a62a-f572ca098931','Parque de Pradolongo','parque','Uno de los grandes parques del sur, con lago, praderas y zonas de juego.','Calle de Rafaela Ybarra, s/n',40.3752,-3.7063,'Usera',0,0,60,'{"sat":["07:00","23:00"],"sun":["07:00","23:00"]}'::jsonb,false,array['naturaleza','familia','niños','activo','deporte']::text[],'https://www.openstreetmap.org/search?query=Parque%20de%20Pradolongo%2C%20Madrid',false),
('72a40530-2717-5d9a-a0cf-3019dd0eddcf','Parque Lineal del Manzanares','parque','Paseos y carril bici junto al río, presididos por la escultura de la Dama del Manzanares.','La Dama del Manzanares, Avenida de los Rosales',40.3782,-3.6838,'Villaverde',0,0,75,'{"sat":["00:00","23:59"],"sun":["00:00","23:59"]}'::jsonb,false,array['naturaleza','familia','deporte','activo','alternativo']::text[],'https://www.openstreetmap.org/search?query=Parque%20Lineal%20del%20Manzanares%2C%20Madrid',false),
('61b7f9d6-b3f2-5b64-a621-7e26c42ed9c0','Quinta de la Fuente del Berro','parque','Jardín romántico escondido, con pavos reales, cascadas y estanques.','Calle de Enrique d''Almonte, 1',40.4227,-3.6613,'Salamanca',0,0,45,'{"sat":["10:00","18:00"],"sun":["10:00","18:00"]}'::jsonb,false,array['naturaleza','tranquilo','familia','pareja','fotogenico']::text[],'https://www.openstreetmap.org/search?query=Quinta%20de%20la%20Fuente%20del%20Berro%2C%20Madrid',false),
('d60d1523-6a1b-58d9-a45c-149be61a4c70','La Mallorquina','cafetería','Pastelería de 1894 famosa por sus napolitanas y su salón con vistas a Sol.','Puerta del Sol, 8',40.4167,-3.7043,'Sol',1,6,30,'{"sat":["08:30","21:00"],"sun":["08:30","21:00"]}'::jsonb,true,array['gastronomia','familia','niños','lluvia']::text[],'https://www.openstreetmap.org/search?query=La%20Mallorquina%20Puerta%20del%20Sol%2C%20Madrid',false),
('9fd4acdd-1135-5ed7-a4cf-23868678b68d','Taberna La Bola','restaurante','Cocido madrileño en puchero de barro desde 1870.','Calle de la Bola, 5',40.42,-3.7104,'Palacio',2,30,90,'{"sat":["13:00","23:30"],"sun":["13:00","16:30"]}'::jsonb,true,array['gastronomia','familia','cultura','lluvia']::text[],'https://www.openstreetmap.org/search?query=Taberna%20La%20Bola%2C%20Madrid',false),
('f4f91a92-6444-5502-a253-f5fd9cdad9dc','Café de Oriente','restaurante','Café-restaurante clásico frente al Palacio Real, con terraza en la plaza.','Plaza de Oriente, 2',40.4183,-3.7114,'Palacio',2,20,60,'{"sat":["09:00","23:30"],"sun":["09:00","23:30"]}'::jsonb,true,array['gastronomia','familia','pareja','lluvia']::text[],'https://www.openstreetmap.org/search?query=Caf%C3%A9%20de%20Oriente%2C%20Madrid',false),
('313471a8-9e7d-5957-a87e-b94f8fe22580','Casa Mingo','restaurante','Sidrería asturiana de 1888 con pollo asado y sidra, ideal para ir con niños.','Paseo de la Florida, 34',40.4251,-3.7254,'Moncloa',1,18,75,'{"sat":["11:00","23:30"],"sun":["11:00","23:30"]}'::jsonb,true,array['gastronomia','familia','niños','amigos','lluvia']::text[],'https://www.openstreetmap.org/search?query=Casa%20Mingo%2C%20Madrid',false),
('a1e8748f-f4e5-5acf-a4a9-1fe9c9da8a72','Casa Alberto','restaurante','Taberna de 1827 con rabo de toro, callos y croquetas caseras.','Calle de las Huertas, 18',40.4139,-3.7001,'Huertas',2,30,90,'{"sat":["12:00","23:30"],"sun":["12:00","23:30"]}'::jsonb,true,array['gastronomia','familia','cultura','lluvia']::text[],'https://www.openstreetmap.org/search?query=Casa%20Alberto%20Huertas%2C%20Madrid',false),
('bf9e6cf2-ee55-525f-a116-380f53a272de','Café Comercial','cafetería','Café histórico de 1887 con desayunos, menú y meriendas.','Glorieta de Bilbao, 7',40.4289,-3.7024,'Malasaña',1,15,60,'{"sat":["09:00","23:59"],"sun":["09:00","23:59"]}'::jsonb,true,array['gastronomia','familia','cultura','lluvia','tranquilo']::text[],'https://www.openstreetmap.org/search?query=Caf%C3%A9%20Comercial%2C%20Madrid',false),
('407a0015-3a53-5602-a00d-c36114cbcdb1','Mercado de San Antón','mercado','Mercado con puestos para picar en la planta alta y terraza en la azotea.','Calle de Augusto Figueroa, 24',40.422,-3.6977,'Chueca',2,20,75,'{"sat":["10:00","23:30"],"sun":["10:00","23:30"]}'::jsonb,true,array['gastronomia','mercadillos','familia','amigos','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20San%20Ant%C3%B3n%2C%20Madrid',false),
('99293a02-cfc4-5a34-a5f8-7198bd6bb3a9','Mercado de Barceló','mercado','Mercado de barrio moderno con puestos para comer algo el sábado por la mañana.','Calle de Barceló, 6',40.4269,-3.6988,'Malasaña',1,10,45,'{"sat":["09:00","14:30"]}'::jsonb,true,array['gastronomia','mercadillos','familia','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20Barcel%C3%B3%2C%20Madrid',false),
('2ec936fe-fdd7-55f4-ac42-d526b9e313ac','Mercado de Vallehermoso','mercado','Mercado de barrio con puestos de cocina de autor a precios razonables.','Calle de Vallehermoso, 36',40.434,-3.7084,'Chamberí',1,18,60,'{"sat":["10:00","23:00"],"sun":["12:00","16:30"]}'::jsonb,true,array['gastronomia','mercadillos','familia','amigos','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20Vallehermoso%2C%20Madrid',false),
('49c4b9a0-8073-56a3-ac39-871b98fd51cd','Mercado de la Paz','mercado','Mercado tradicional del barrio de Salamanca, famoso por su tortilla de patatas.','Calle de Ayala, 28',40.4276,-3.6857,'Salamanca',1,12,45,'{"sat":["09:00","15:00"]}'::jsonb,true,array['gastronomia','mercadillos','familia','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20la%20Paz%2C%20Madrid',false),
('b8984308-33e7-5664-a427-290bc4f36c00','Mercado de Chamartín','mercado','Mercado gourmet de barrio con barras para tomar el aperitivo.','Calle de Bolivia, 9',40.4573,-3.678,'Chamartín',2,15,45,'{"sat":["09:00","14:30"]}'::jsonb,true,array['gastronomia','mercadillos','familia','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20Chamart%C3%ADn%2C%20Madrid',false),
('67f6072d-d700-59a7-a4dd-1fff66737b04','Mercado de Maravillas','mercado','Uno de los mercados más grandes de Europa, con puestos de comida latinoamericana.','Calle de Bravo Murillo, 122',40.4491,-3.7038,'Tetuán',1,10,45,'{"sat":["09:00","14:30"]}'::jsonb,true,array['gastronomia','mercadillos','familia','alternativo','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20Maravillas%2C%20Madrid',false),
('514fe95e-acc3-555c-a08b-0b0760a9298e','Mercado de la Cebada','mercado','Mercado popular de La Latina; los sábados a mediodía se llena de puestos de marisco.','Plaza de la Cebada, 15',40.4111,-3.7098,'La Latina',1,12,45,'{"sat":["09:00","15:00"]}'::jsonb,true,array['gastronomia','mercadillos','familia','amigos','lluvia']::text[],'https://www.openstreetmap.org/search?query=Mercado%20de%20la%20Cebada%2C%20Madrid',false)
on conflict (id) do update set name=excluded.name, category=excluded.category, description=excluded.description, address=excluded.address, lat=excluded.lat, lng=excluded.lng, neighborhood=excluded.neighborhood, price_level=excluded.price_level, avg_cost_eur=excluded.avg_cost_eur, avg_duration_min=excluded.avg_duration_min, opening_hours=excluded.opening_hours, indoor=excluded.indoor, tags=excluded.tags, external_url=excluded.external_url;

