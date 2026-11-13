# Planazo · prototipo (Madrid)

Web app mobile-first: "Dime cómo quieres sentirte este fin de semana y Planazo te propone qué hacer, dónde ir y cómo encajarlo en tu tiempo y presupuesto."

## Arrancar en local
```bash
npm install
npm run dev        # http://localhost:5173
```
Sin credenciales funciona en **modo demo** (datos en el navegador y planificador local).

## Supabase
1. Crea un proyecto en supabase.com.
2. Pega `supabase/setup.sql` entero en el SQL Editor y pulsa Run (esquema, permisos y lugares). Para actualizar solo los lugares, vuelve a ejecutar `supabase/seed.sql` (es repetible).
   En Authentication → URL Configuration, añade la URL publicada a Site URL y Redirect URLs.
   La web publicada en GitHub Pages ya usa el proyecto configurado en `.github/workflows/deploy.yml`.
3. Si el proyecto ya existía, ejecuta también `supabase/migrations/0003_auth.sql` (cuentas con contraseña: perfil protegido, borrar cuenta, límite gratuito corregido). Es repetible.

### Cuentas y acceso
- Email y contraseña (mín. 8 caracteres con letras y números), verificación por email, recuperación de contraseña, enlace mágico opcional, sesión persistente y cierre de sesión (`src/lib/auth.ts`).
- Rutas públicas: portada, `/entrar`, `/registro`, `/recuperar`, `/restablecer`, `/creditos` y planes compartidos `/p/:slug`. El resto pide sesión (`RequireAuth`) y, tras entrar, vuelve a la página pedida.
- En Supabase → Authentication: deja activado "Confirm email" y sube la longitud mínima de contraseña a 8. El correo incluido de Supabase solo envía a miembros del equipo del proyecto y con pocos envíos por hora: para usuarios reales configura un SMTP propio (Authentication → Emails → SMTP).
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
- `scripts/places.src.mjs` (40 lugares iniciales) y `scripts/places.family.mjs` (ocio en familia y restaurantes de todo Madrid) → `node scripts/gen-seed.mjs` regenera `src/data/places.json`, `supabase/seed.sql` y `supabase/setup.sql`.
- `src/lib/planner.ts` → planificador local (fallback de la IA): proximidad, presupuesto y horario.
- `src/lib/routing.ts` → rutas a pie OSRM (línea recta si falla). `src/lib/geocode.ts` → Nominatim con caché.
- `src/components/ItineraryView.tsx` + `MapView.tsx` → Feature 2 (itinerario + mapa Leaflet con teselas estándar de OpenStreetMap, sin clave; se cambian en `src/lib/tiles.ts` o con `VITE_TILES_URL`).

Horarios y precios del seed son estimaciones (`is_verified = false`).
