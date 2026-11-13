# Planazo · prototipo (Madrid)

Web app mobile-first: "Dime cómo quieres sentirte este fin de semana y Planazo te propone qué hacer, dónde ir y cómo encajarlo en tu tiempo y presupuesto."

## Arrancar en local
```bash
npm install
npm run dev        # http://localhost:5173
```
Sin credenciales funciona en **modo demo** (datos en el navegador y planificador local).

## Conectar Supabase (opcional)
1. Crea un proyecto en supabase.com.
2. Ejecuta `supabase/migrations/0001_schema.sql` y después `supabase/seed.sql` en el SQL editor.
3. Crea `.env.local` con:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Activar el agente de IA (Claude)
Sin esto, la app usa el planificador local (mismo formato de salida).
```bash
supabase functions deploy generate-plan
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```
La función (`supabase/functions/generate-plan`) usa el modelo `claude-opus-5-5` con salida JSON estricta y solo puede elegir lugares de la tabla `places`. Tiene activado el respaldo automático del servidor (`fallbacks: "default"`) por si el modelo rechaza una petición. Si la función falla o tarda más de 50 s, la app usa el planificador local.

## Estructura
- `scripts/places.src.mjs` → fuente de los 40 lugares; `node scripts/gen-seed.mjs` regenera `src/data/places.json` y `supabase/seed.sql`.
- `src/lib/planner.ts` → planificador local (fallback de la IA): proximidad, presupuesto y horario.
- `src/lib/routing.ts` → rutas a pie OSRM (línea recta si falla). `src/lib/geocode.ts` → Nominatim con caché.
- `src/components/ItineraryView.tsx` + `MapView.tsx` → Feature 2 (itinerario + mapa Leaflet con teselas CARTO Voyager; se cambian en `src/lib/tiles.ts` o con `VITE_TILES_URL`).

Horarios y precios del seed son estimaciones (`is_verified = false`).
