-- Permisos explícitos para la API de datos (las reglas RLS siguen decidiendo qué filas ve cada uno).
grant usage on schema public to anon, authenticated;
grant select on public.places, public.geocode_cache to anon, authenticated;
grant insert on public.geocode_cache to authenticated;
grant select on public.itineraries, public.itinerary_items to anon;
grant select, insert, update, delete on public.profiles, public.preferences, public.itineraries, public.itinerary_items, public.chat_messages to authenticated;
