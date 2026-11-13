// Supabase Edge Function: generate-plan
// Llama a Claude con salida JSON estricta. El agente SOLO puede elegir lugares de la tabla `places`,
// que se le pasan filtrados por intereses, día y precio.
// Secretos necesarios: ANTHROPIC_API_KEY (supabase secrets set ANTHROPIC_API_KEY=...).
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.8.0/helpers/zod'
import { z } from 'npm:zod@4'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SlotSchema = z.object({
  day: z.enum(['sat', 'sun']),
  start_time: z.string().describe('HH:MM'),
  end_time: z.string().describe('HH:MM'),
  place_id: z.string().describe('id exacto de la lista de lugares'),
  title: z.string(),
  reason: z.string().describe('Una frase: por qué encaja con lo que pidió la persona'),
  est_cost: z.number().describe('Coste estimado por persona en euros'),
  duration_min: z.number(),
  verify_note: z.string(),
})
const PlanSchema = z.object({ slots: z.array(SlotSchema), message: z.string().describe('Mensaje breve y cercano para la persona') })

type Day = 'sat' | 'sun'
interface Prefs {
  day: Day | 'both'; companions: string | null; budget: number; pace: string | null; interests: string[]; mood: string
  constraints: { cheaper?: boolean; calmer?: boolean; rain?: boolean; avoidNeighborhoods?: string[]; startTime?: string; endTime?: string; origin?: { label: string; lat: number; lng: number } }
}
interface Place {
  id: string; name: string; category: string; neighborhood: string; lat: number; lng: number; price_level: number; avg_cost_eur: number
  avg_duration_min: number; opening_hours: Partial<Record<Day, [string, string]>>; indoor: boolean; tags: string[]
}

const SYSTEM = `Eres el agente de Planazo, un planificador de fines de semana en Madrid.
Reglas:
- Responde en español, con tono cercano y breve.
- Elige SOLO lugares de la lista recibida y usa su "id" exacto en place_id. Nunca inventes lugares.
- Ordena las paradas por proximidad para minimizar los traslados a pie y deja tiempo de traslado entre paradas.
- Respeta el presupuesto por persona (la suma de est_cost no lo supera) y el horario de apertura de cada lugar ese día.
- Si la franja de comida (13:30-15:00) cae dentro del plan, incluye una parada para comer.
- Nunca afirmes disponibilidad, precios ni horarios en tiempo real: son estimaciones. verify_note recuerda confirmarlos.
- No reservas ni compras nada: solo recomiendas y organizas.
- reason es una sola frase que explica por qué la parada encaja con lo que pidió la persona.`

function candidates(places: Place[], p: Prefs): Place[] {
  const days: Day[] = p.day === 'both' ? ['sat', 'sun'] : [p.day]
  const avoid = new Set(p.constraints.avoidNeighborhoods ?? [])
  const budget = p.budget * (p.constraints.cheaper ? 0.6 : 1)
  return places
    .filter((x) => days.some((d) => x.opening_hours?.[d]) && x.avg_cost_eur <= budget && !avoid.has(x.neighborhood))
    .filter((x) => !p.constraints.rain || x.indoor || x.category === 'restaurante' || x.category === 'bar')
    .map((x) => ({ x, s: p.interests.filter((i) => x.tags.includes(i)).length * 2 + (p.companions && x.tags.includes(p.companions) ? 1 : 0) + (FOOD.has(x.category) ? 1 : 0) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 30)
    .map(({ x }) => x)
}
const FOOD = new Set(['restaurante', 'bar', 'mercado', 'cafetería'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const { prefs } = (await req.json()) as { prefs: Prefs }
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'NO_LLM_KEY' }, 503)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data, error } = await sb.from('places').select('id,name,category,neighborhood,lat,lng,price_level,avg_cost_eur,avg_duration_min,opening_hours,indoor,tags')
    if (error) throw error
    const list = candidates(data as Place[], prefs)
    const stops = prefs.constraints.calmer || prefs.pace === 'tranquilo' ? 3 : prefs.pace === 'intenso' ? 5 : 4

    const user = `Preferencias:
- Día: ${prefs.day === 'both' ? 'sábado y domingo (reparte las paradas entre los dos)' : prefs.day === 'sat' ? 'sábado' : 'domingo'}
- Compañía: ${prefs.companions ?? 'sin especificar'}
- Presupuesto por persona: ${Math.round(prefs.budget * (prefs.constraints.cheaper ? 0.6 : 1))} €
- Ritmo: ${prefs.constraints.calmer ? 'tranquilo' : prefs.pace ?? 'equilibrado'} → unas ${stops} paradas${prefs.day === 'both' ? ' por día' : ''}
- Intereses: ${prefs.interests.join(', ') || 'sorpréndeme'}
- Cómo quiere sentirse: ${prefs.mood || 'sin especificar'}
- Horario: desde ${prefs.constraints.startTime ?? '10:30'} hasta ${prefs.constraints.endTime ?? '22:00'}
${prefs.constraints.rain ? '- Puede llover: prioriza sitios a cubierto.\n' : ''}${prefs.constraints.origin ? `- Sale desde: ${prefs.constraints.origin.label} (${prefs.constraints.origin.lat.toFixed(4)}, ${prefs.constraints.origin.lng.toFixed(4)})\n` : ''}
Lugares disponibles (JSON; opening_hours por día sat/sun, coste en € por persona):
${JSON.stringify(list.map((x) => ({ id: x.id, name: x.name, cat: x.category, barrio: x.neighborhood, lat: x.lat, lng: x.lng, coste: x.avg_cost_eur, min: x.avg_duration_min, horario: x.opening_hours, cubierto: x.indoor, tags: x.tags })))}`

    const client = new Anthropic({ apiKey })
    const res = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: zodOutputFormat(PlanSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    })
    if (res.stop_reason === 'refusal' || !res.parsed_output) return json({ error: 'NO_PLAN' }, 502)

    // Validación: solo ids de la tabla, sin repetidos.
    const ids = new Set(list.map((x) => x.id))
    const seen = new Set<string>()
    const slots = res.parsed_output.slots.filter((s) => ids.has(s.place_id) && !seen.has(s.place_id) && seen.add(s.place_id))
    if (!slots.length) return json({ error: 'NO_PLAN' }, 502)
    return json({ slots, message: res.parsed_output.message, source: 'ia' })
  } catch (e) {
    console.error(e)
    return json({ error: 'INTERNAL', detail: String(e) }, 500)
  }
})
