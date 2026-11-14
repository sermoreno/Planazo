import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Droplets, Moon, Sun, Thermometer, Umbrella } from 'lucide-react'
import { DAY_LABEL, cn } from '@/lib/utils'
import { COLD, HOT, dayNumber, rainRisk, wetHour, wxKind, wxLabel, type DayWx, type HourWx } from '@/lib/weather'
import type { Day } from '@/lib/types'

export function WeatherIcon({ code, night, className }: { code: number; night?: boolean; className?: string }) {
  const k = wxKind(code)
  const I = k === 'clear' ? (night ? Moon : Sun) : k === 'partly' ? (night ? CloudMoon : CloudSun) : k === 'fog' ? CloudFog : k === 'drizzle' ? CloudDrizzle : k === 'rain' ? CloudRain : k === 'snow' ? CloudSnow : k === 'storm' ? CloudLightning : Cloud
  const tone = k === 'clear' || k === 'partly' ? (night ? 'text-noche-600' : 'text-[#E8A317]') : k === 'rain' || k === 'drizzle' || k === 'storm' ? 'text-[#2F6FB0]' : 'text-noche-600'
  return <I className={cn('h-5 w-5 shrink-0', tone, className)} aria-hidden />
}

/** Crédito obligatorio de Open-Meteo (CC BY 4.0). */
export function WeatherCredit({ className, light }: { className?: string; light?: boolean }) {
  return <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className={cn('text-[11px] font-medium underline-offset-2 hover:underline', light ? 'text-white/70' : 'text-noche-400', className)}>Tiempo: Open-Meteo.com</a>
}

const deg = (n: number) => `${Math.round(n)}°`

/** Tarjeta pequeña de un día: icono, máx/mín y probabilidad de lluvia. */
export function DayForecast({ day, wx, selected }: { day: Day; wx: DayWx | undefined; selected?: boolean }) {
  if (!wx) return null
  const risk = rainRisk(wx)
  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 px-2.5 py-2 sm:gap-2.5 sm:px-3', selected ? 'border-noche/20 bg-white' : 'border-transparent bg-noche/5 opacity-70')}
      aria-label={`${DAY_LABEL[day]} ${dayNumber(wx.date)}: ${wxLabel(wx.code)}, máxima ${deg(wx.max)}, mínima ${deg(wx.min)}${wx.rainProb != null ? `, ${wx.rainProb} % de lluvia` : ''}`} role="group">
      <WeatherIcon code={wx.code} className="h-7 w-7" />
      <div className="min-w-0 text-sm leading-tight" aria-hidden>
        <p className="font-bold">{DAY_LABEL[day]} {dayNumber(wx.date)}<span className="hidden font-normal text-noche-600 sm:inline"> · {wxLabel(wx.code)}</span></p>
        <p className="mt-0.5 flex flex-wrap gap-x-2">
          <span className="whitespace-nowrap"><span className="font-extrabold">{deg(wx.max)}</span><span className="text-noche-600"> / {deg(wx.min)}</span></span>
          {wx.rainProb != null && <span className={cn('whitespace-nowrap', risk === 'alta' ? 'font-semibold text-[#2F6FB0]' : 'text-noche-600')}><Droplets className="inline h-3.5 w-3.5 -translate-y-px" aria-hidden /> {wx.rainProb} %</span>}
        </p>
      </div>
    </div>
  )
}

/** Etiqueta de tiempo en cada parada (a su hora de inicio). */
export function StopWeather({ wx, indoor }: { wx: HourWx | undefined; indoor: boolean }) {
  if (!wx) return null
  const wet = wetHour(wx), hot = wx.temp >= HOT, cold = wx.temp <= COLD
  const warn = !indoor && (wet || hot)
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', warn ? 'bg-[#E3EEF9] text-[#1D4E80]' : 'bg-noche/5 text-noche')}
      title={`${wxLabel(wx.code)}, ${deg(wx.temp)}${wx.rainProb != null ? `, ${wx.rainProb} % de lluvia` : ''}`}>
      <WeatherIcon code={wx.code} night={!wx.isDay} className="h-3.5 w-3.5" />
      {deg(wx.temp)}
      {wx.rainProb != null && wx.rainProb >= 20 && <span>· {wx.rainProb} %</span>}
      {!indoor && wet && <span>· mejor a cubierto</span>}
      {!indoor && !wet && hot && <span>· calor</span>}
      {cold && !wet && <span>· frío</span>}
    </span>
  )
}

export interface PlanWxSummary { day: Day; wx: DayWx; wetOutdoor: string[]; hotOutdoor: { name: string; temp: number }[]; coldest: number | null }

/** Resumen del tiempo del plan con avisos y, si hay paradas al aire libre con lluvia, botón para adaptarlo. */
export function PlanWeather({ items, onRain, where = 'Madrid' }: { items: PlanWxSummary[]; onRain?: () => void; where?: string }) {
  if (!items.length) return null
  const wet = items.flatMap((i) => i.wetOutdoor)
  const hot = items.flatMap((i) => i.hotOutdoor)
  const coldest = Math.min(...items.map((i) => i.coldest ?? 99))
  return (
    <section aria-label="Tiempo previsto" className="mb-4 rounded-card bg-white p-3 shadow-soft">
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <div key={i.day} className="flex min-w-[9.5rem] flex-1 items-center gap-2.5">
            <WeatherIcon code={i.wx.code} className="h-8 w-8" />
            <div className="text-sm leading-tight">
              <p className="font-bold">{items.length > 1 ? `${DAY_LABEL[i.day]} ${dayNumber(i.wx.date)}` : `${DAY_LABEL[i.day]} ${dayNumber(i.wx.date)} en ${where}`}</p>
              <p className="text-noche-600"><span className="font-extrabold text-noche">{deg(i.wx.max)}</span> / {deg(i.wx.min)} · {wxLabel(i.wx.code)}{i.wx.rainProb != null && ` · ${i.wx.rainProb} % lluvia`}</p>
            </div>
          </div>
        ))}
      </div>
      {wet.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-[#E3EEF9] px-3 py-2.5 text-[14px] text-[#1D4E80] sm:flex-row sm:items-center">
          <p className="flex min-w-0 flex-1 items-start gap-2"><Umbrella className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><b>Puede llover</b> en {wet.length === 1 ? 'una parada al aire libre' : `${wet.length} paradas al aire libre`}: {wet.join(', ')}.</span></p>
          {onRain && <button type="button" onClick={onRain} className="min-h-10 shrink-0 self-start rounded-full bg-[#1D4E80] px-4 text-sm font-bold text-white transition hover:bg-[#173F68] active:scale-95 sm:self-auto">Adaptar a la lluvia</button>}
        </div>
      )}
      {hot.length > 0 && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-coral-50 px-3 py-2.5 text-[14px] text-coral-700">
          <Thermometer className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span><b>Hará calor</b> ({deg(Math.max(...hot.map((h) => h.temp)))}) en {hot.map((h) => h.name).join(', ')}: lleva agua y busca sombra.</span>
        </p>
      )}
      {coldest <= COLD && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-noche/5 px-3 py-2.5 text-[14px]">
          <Thermometer className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><b>Abrígate:</b> bajará hasta {deg(coldest)} durante el plan.</span>
        </p>
      )}
      <div className="mt-2 flex justify-end"><WeatherCredit /></div>
    </section>
  )
}
