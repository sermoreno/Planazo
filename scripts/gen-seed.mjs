import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { places as base } from './places.src.mjs';
import { family } from './places.family.mjs';
import { escapadas } from './places.escapadas.mjs';
const places = [...base, ...family, ...escapadas];
const uuid = (s) => { const h = createHash('sha1').update('planazo:' + s).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
const rows = places.map((p) => ({ id: uuid(p.name), ...p, is_verified: false }));
if (new Set(rows.map((r) => r.name)).size !== rows.length) throw new Error('Nombres duplicados');
writeFileSync(new URL('../src/data/places.json', import.meta.url), JSON.stringify(rows, null, 1));
const q = (v) => v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const arr = (a) => `array[${a.map(q).join(',')}]::text[]`;
const sql = [`-- Seed generado por scripts/gen-seed.mjs: ${rows.length} lugares reales de Madrid y escapadas por la Comunidad (is_verified = false).`, 'insert into public.places (id,name,category,description,address,lat,lng,neighborhood,price_level,avg_cost_eur,avg_duration_min,opening_hours,indoor,tags,external_url,is_verified) values'];
sql.push(rows.map((r) => `(${[q(r.id),q(r.name),q(r.category),q(r.description),q(r.address),r.lat,r.lng,q(r.neighborhood),r.price_level,r.avg_cost_eur,r.avg_duration_min,q(JSON.stringify(r.opening_hours))+'::jsonb',r.indoor,arr(r.tags),q(r.external_url),false].join(',')})`).join(',\n') + '\non conflict (id) do update set name=excluded.name, category=excluded.category, description=excluded.description, address=excluded.address, lat=excluded.lat, lng=excluded.lng, neighborhood=excluded.neighborhood, price_level=excluded.price_level, avg_cost_eur=excluded.avg_cost_eur, avg_duration_min=excluded.avg_duration_min, opening_hours=excluded.opening_hours, indoor=excluded.indoor, tags=excluded.tags, external_url=excluded.external_url;');
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql.join('\n') + '\n');
// Un único archivo para pegar en el SQL Editor de Supabase: esquema + permisos + lugares.
const mig = (f) => readFileSync(new URL('../supabase/migrations/' + f, import.meta.url), 'utf8');
writeFileSync(new URL('../supabase/setup.sql', import.meta.url), ['-- Planazo · instalación completa en Supabase (pegar entero en SQL Editor y pulsar Run).', mig('0001_schema.sql'), mig('0002_grants.sql'), mig('0003_auth.sql'), mig('0004_roles_security.sql'), sql.join('\n'), ''].join('\n\n'));
console.log('OK', rows.length);
