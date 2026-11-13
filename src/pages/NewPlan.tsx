import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Loader2, MapPin, Shuffle, Sparkles, Umbrella } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PhotoBackdrop } from '@/components/PhotoBackdrop'
import { heroPhotos } from '@/lib/photos'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { COMPANIONS, generatePlan, greeting, INTERESTS, missingQuestions, PACES, surprise, type Question } from '@/lib/agent'
import { geocode } from '@/lib/geocode'
import { putDraft } from '@/lib/store'
import type { DayChoice, Interest, Preferences } from '@/lib/types'
import { cn } from '@/lib/utils'

const DAYS: { label: string; value: DayChoice }[] = [{ label: 'Sábado', value: 'sat' }, { label: 'Domingo', value: 'sun' }, { label: 'Sáb. y dom.', value: 'both' }]
const INITIAL: Preferences = { day: 'sat', companions: null, budget: 60, pace: null, interests: [], mood: '', constraints: { startTime: '10:30', endTime: '22:00' } }

type Msg = { role: 'assistant' | 'user'; text: string }
type Stage = 'form' | 'chat' | 'generating'

export default function NewPlan() {
  const location = useLocation()
  const navState = location.state as { mood?: string; origin?: { label: string; lat: number; lng: number } } | null
  const [prefs, setPrefs] = useState<Preferences>(() => ({ ...INITIAL, mood: navState?.mood ?? '', constraints: { ...INITIAL.constraints, origin: navState?.origin } }))
  const [origin, setOrigin] = useState(navState?.origin?.label ?? '')
  const [stage, setStage] = useState<Stage>('form')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [queue, setQueue] = useState<Question[]>([])
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const set = (patch: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...patch }))

  async function withOrigin(p: Preferences): Promise<Preferences> {
    if (!origin.trim()) return { ...p, constraints: { ...p.constraints, origin: undefined } }
    if (p.constraints.origin?.label === origin.trim()) return p
    setBusy(true)
    const g = await geocode(origin).catch(() => null)
    setBusy(false)
    return g ? { ...p, constraints: { ...p.constraints, origin: { label: origin.trim(), ...g } } } : p
  }

  async function onContinue() {
    const p = await withOrigin(prefs)
    setPrefs(p)
    const q = missingQuestions(p)
    setQueue(q)
    setMsgs([{ role: 'assistant', text: greeting(p) }, ...(q[0] ? [{ role: 'assistant' as const, text: q[0].text }] : [{ role: 'assistant' as const, text: 'Lo tengo todo. Revisa el resumen y lo genero.' }])])
    setStage('chat')
    window.scrollTo({ top: 0 })
  }

  function answer(q: Question, value: string | null, label: string) {
    const patch: Partial<Preferences> =
      value === null ? {} : q.key === 'interests' ? { interests: [value as Interest] } : ({ [q.key]: value } as Partial<Preferences>)
    if (value === null && q.key === 'pace') patch.pace = 'equilibrado'
    set(patch)
    const rest = queue.slice(1)
    setQueue(rest)
    setMsgs((m) => [...m, { role: 'user', text: label }, { role: 'assistant', text: rest[0]?.text ?? 'Perfecto. Este es el resumen: toca cualquier dato para cambiarlo y genero tu plan.' }])
  }

  async function run(p: Preferences) {
    setStage('generating')
    window.scrollTo({ top: 0 })
    const { it, message } = await generatePlan({ ...p, pace: p.pace ?? 'equilibrado' })
    putDraft({ ...it, agent_message: message })
    navigate(`/plan/${it.id}`, { replace: true })
  }

  async function onSurprise() {
    const p = surprise(await withOrigin(prefs))
    setPrefs(p)
    run(p)
  }

  if (stage === 'generating') return <Generating />

  if (stage === 'chat')
    return (
      <main className="pb-16">
        <section className="relative -mt-14 overflow-hidden pb-8 pt-24 text-white">
          <PhotoBackdrop photos={heroPhotos().slice(1, 4)} overlay="band" interval={8000} showCredit={false} />
          <div className="relative z-10 mx-auto max-w-2xl px-4">
            <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-white/75">Paso 2 de 2</p>
            <h1 className="mt-1 text-[30px] font-extrabold leading-tight tracking-tight sm:text-4xl">Afinemos tu plan</h1>
          </div>
        </section>
        <div className="mx-auto max-w-2xl px-4 pt-6">
        <ul className="space-y-3" aria-live="polite">
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex', m.role === 'user' && 'justify-end')}>
                {m.role === 'assistant' && <span className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coral text-sm font-extrabold text-noche" aria-hidden>P</span>}
                <p className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px]', m.role === 'assistant' ? 'rounded-tl-sm bg-white shadow-soft' : 'rounded-tr-sm bg-noche text-white')}>
                  <span className="sr-only">{m.role === 'assistant' ? 'Planazo: ' : 'Tú: '}</span>{m.text}
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {queue[0] ? (
          <div className="mt-4 flex flex-wrap gap-2 pl-10">
            {queue[0].options.map((o) => <Chip key={o.value} onClick={() => answer(queue[0], o.value, o.label)}>{o.label}</Chip>)}
            <Chip className="border-transparent bg-transparent text-noche-600" onClick={() => answer(queue[0], null, 'Me da igual')}>Me da igual</Chip>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Summary prefs={prefs} set={set} />
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStage('form')}>Volver a preferencias</Button>
              <Button size="lg" onClick={() => run(prefs)}><Sparkles className="h-5 w-5" aria-hidden /> Generar mi plan</Button>
            </div>
          </motion.div>
        )}
        </div>
      </main>
    )

  return (
    <main className="pb-32">
      <section className="relative -mt-14 overflow-hidden pb-16 pt-24 text-white sm:pb-20 sm:pt-28">
        <PhotoBackdrop photos={heroPhotos().slice(1, 4)} overlay="band" interval={8000} />
        <div className="relative z-10 mx-auto max-w-2xl px-4">
          <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-white/75">Paso 1 de 2</p>
          <h1 className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight sm:text-5xl">Cuéntame tu finde</h1>
          <p className="mt-1 text-white/85">Rellena lo que quieras: lo que falte te lo pregunto yo.</p>
        </div>
      </section>
      <div className="relative z-10 mx-auto -mt-10 max-w-2xl px-4">
      <div className="rounded-[24px] bg-white px-4 pb-6 pt-1 shadow-soft sm:px-6">

      <Field label="¿Cuándo?">
        {DAYS.map((d) => <Chip key={d.value} selected={prefs.day === d.value} onClick={() => set({ day: d.value })}>{d.label}</Chip>)}
      </Field>
      <Field label="¿Con quién?">
        {COMPANIONS.map((c) => <Chip key={c.value} selected={prefs.companions === c.value} onClick={() => set({ companions: prefs.companions === c.value ? null : c.value })}>{c.label}</Chip>)}
      </Field>
      <Field label="Presupuesto por persona" aside={<span className="text-lg font-extrabold">{prefs.budget === 0 ? 'Solo gratis' : `${prefs.budget} €`}</span>}>
        <Slider value={[prefs.budget]} min={0} max={150} step={5} onValueChange={([v]) => set({ budget: v })} />
        <div className="flex w-full justify-between text-xs font-semibold text-noche-600"><span>0 €</span><span>150 €</span></div>
      </Field>
      <Field label="Ritmo">
        {PACES.map((p) => <Chip key={p.value} selected={prefs.pace === p.value} onClick={() => set({ pace: prefs.pace === p.value ? null : p.value })}>{p.label}</Chip>)}
      </Field>
      <Field label="¿Qué te interesa?">
        {INTERESTS.map((i) => {
          const on = prefs.interests.includes(i.value)
          return <Chip key={i.value} selected={on} onClick={() => set({ interests: on ? prefs.interests.filter((x) => x !== i.value) : [...prefs.interests, i.value] })}>{i.label}</Chip>
        })}
      </Field>
      <Field label="¿Cómo quieres sentirte?" htmlFor="mood">
        <textarea
          id="mood" rows={3} value={prefs.mood} onChange={(e) => set({ mood: e.target.value })}
          placeholder="Ej.: con ganas de desconectar y acabar viendo el atardecer"
          className="w-full rounded-card border-2 border-noche/15 bg-white px-4 py-3 text-[15px] placeholder:text-noche-400 focus:border-noche focus:outline-none"
        />
      </Field>
      <Field label="¿Desde dónde sales? (opcional)" htmlFor="origin">
        <div className="relative w-full">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-noche-600" aria-hidden />
          <input
            id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Barrio o dirección, p. ej. Malasaña"
            className="h-12 w-full rounded-full border-2 border-noche/15 bg-white pl-10 pr-4 text-[15px] placeholder:text-noche-400 focus:border-noche focus:outline-none"
          />
        </div>
      </Field>
      </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[1100] border-t border-noche/10 bg-crema/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
          <Button variant="outline" className="flex-1" onClick={onSurprise} disabled={busy}><Shuffle className="h-4 w-4" aria-hidden /> Sorpréndeme</Button>
          <Button className="flex-[1.4]" onClick={onContinue} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Continuar <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </main>
  )
}

function Field({ label, children, aside, htmlFor }: { label: string; children: React.ReactNode; aside?: React.ReactNode; htmlFor?: string }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        {htmlFor ? <label htmlFor={htmlFor} className="font-bold">{label}</label> : <h2 className="font-bold">{label}</h2>}
        {aside}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

/** Resumen editable de restricciones antes de generar. */
function Summary({ prefs, set }: { prefs: Preferences; set: (p: Partial<Preferences>) => void }) {
  const c = prefs.constraints
  const row = 'border-t border-noche/10 py-3 first:border-0'
  return (
    <Card className="ml-0 mt-4 p-4 sm:ml-10">
      <h2 className="text-lg font-extrabold">Resumen de tu plan</h2>
      <div className={row}>
        <p className="mb-2 text-sm font-bold text-noche-600">Día</p>
        <div className="flex flex-wrap gap-2">{DAYS.map((d) => <Chip key={d.value} className="min-h-9 px-3 py-1 text-sm" selected={prefs.day === d.value} onClick={() => set({ day: d.value })}>{d.label}</Chip>)}</div>
      </div>
      <div className={row}>
        <p className="mb-2 text-sm font-bold text-noche-600">Compañía</p>
        <div className="flex flex-wrap gap-2">{COMPANIONS.map((x) => <Chip key={x.value} className="min-h-9 px-3 py-1 text-sm" selected={prefs.companions === x.value} onClick={() => set({ companions: x.value })}>{x.label}</Chip>)}</div>
      </div>
      <div className={row}>
        <div className="mb-1 flex justify-between text-sm font-bold"><span className="text-noche-600">Presupuesto por persona</span><span>{prefs.budget} €</span></div>
        <Slider value={[prefs.budget]} min={0} max={150} step={5} onValueChange={([v]) => set({ budget: v })} />
      </div>
      <div className={row}>
        <p className="mb-2 text-sm font-bold text-noche-600">Ritmo</p>
        <div className="flex flex-wrap gap-2">{PACES.map((x) => <Chip key={x.value} className="min-h-9 px-3 py-1 text-sm" selected={(prefs.pace ?? 'equilibrado') === x.value} onClick={() => set({ pace: x.value })}>{x.label}</Chip>)}</div>
      </div>
      <div className={row}>
        <p className="mb-2 text-sm font-bold text-noche-600">Intereses</p>
        <div className="flex flex-wrap gap-2">{INTERESTS.map((x) => {
          const on = prefs.interests.includes(x.value)
          return <Chip key={x.value} className="min-h-9 px-3 py-1 text-sm" selected={on} onClick={() => set({ interests: on ? prefs.interests.filter((i) => i !== x.value) : [...prefs.interests, x.value] })}>{x.label}</Chip>
        })}</div>
      </div>
      <div className={cn(row, 'flex flex-wrap items-end gap-3')}>
        <TimeInput id="start" label="Empezar a las" value={c.startTime ?? '10:30'} onChange={(v) => set({ constraints: { ...c, startTime: v } })} />
        <TimeInput id="end" label="Terminar antes de" value={c.endTime ?? '22:00'} onChange={(v) => set({ constraints: { ...c, endTime: v } })} />
        <Chip className="min-h-9 px-3 py-1 text-sm" selected={!!c.rain} onClick={() => set({ constraints: { ...c, rain: !c.rain } })}><Umbrella className="mr-1 inline h-4 w-4" aria-hidden />Puede llover</Chip>
      </div>
      <div className={row}>
        <label htmlFor="mood2" className="mb-2 block text-sm font-bold text-noche-600">Cómo quieres sentirte</label>
        <input id="mood2" value={prefs.mood} onChange={(e) => set({ mood: e.target.value })} placeholder="Opcional" className="h-11 w-full rounded-full border-2 border-noche/15 px-4 text-[15px] focus:border-noche focus:outline-none" />
      </div>
      {c.origin && <p className="border-t border-noche/10 pt-3 text-sm text-noche-600"><MapPin className="mr-1 inline h-4 w-4" aria-hidden />Sales desde {c.origin.label}</p>}
    </Card>
  )
}

function TimeInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-noche-600">{label}</label>
      <input id={id} type="time" value={value} step={900} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-11 rounded-full border-2 border-noche/15 bg-white px-4 font-semibold focus:border-noche focus:outline-none" />
    </div>
  )
}

const LINES = ['Buscando sitios que encajen contigo…', 'Ordenando paradas por cercanía…', 'Cuadrando horarios y presupuesto…', 'Escribiendo por qué encaja cada parada…']
function Generating() {
  const [i, setI] = useState(0)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => { t.current = window.setInterval(() => setI((x) => (x + 1) % LINES.length), 1400); return () => clearInterval(t.current) }, [])
  return (
    <main className="relative -mt-14 min-h-[100svh] overflow-hidden" aria-busy="true">
      <PhotoBackdrop photos={heroPhotos()} overlay="dim" interval={3200} showCredit={false} />
      <div className="relative z-10 mx-auto max-w-xl px-4 pt-28">
        <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-white/70">Preparando tu planazo</p>
        <p className="mt-2 flex min-h-[2.5em] items-start gap-2 text-2xl font-extrabold leading-tight text-white sm:text-3xl" role="status"><Loader2 className="mt-1.5 h-6 w-6 shrink-0 animate-spin text-coral" aria-hidden />{LINES[i]}</p>
        {[0, 1, 2, 3].map((k) => (
          <motion.div key={k} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + k * 0.12 }} className="mt-4 flex gap-3 rounded-card border border-white/15 bg-white/10 p-4 backdrop-blur-md">
            <Skeleton className="h-9 w-9 rounded-full bg-white/25" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-24 bg-white/25" /><Skeleton className="h-5 w-2/3 bg-white/30" /><Skeleton className="h-4 w-full bg-white/20" /><Skeleton className="h-4 w-5/6 bg-white/20" /></div>
          </motion.div>
        ))}
      </div>
    </main>
  )
}
