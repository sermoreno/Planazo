import { Mail } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import { signIn } from '@/lib/store'
import { supabase } from '@/lib/supabase'

/** Acceso con magic link. En modo demo (sin Supabase) entra al momento. */
export function LoginForm({ onDone, note }: { onDone?: () => void; note?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    try {
      const r = await signIn(email.trim())
      if (r === 'demo') { setState('idle'); onDone?.() } else setState('sent')
    } catch (x) { setErr(x instanceof Error ? x.message : 'No se pudo enviar el enlace'); setState('error') }
  }
  if (state === 'sent') return (
    <div className="rounded-card bg-white p-4 shadow-soft">
      <p className="flex items-center gap-2 font-bold"><Mail className="h-5 w-5 text-coral-700" aria-hidden /> Revisa tu correo</p>
      <p className="mt-1 text-noche-600">Te he enviado un enlace a <b className="text-noche">{email}</b>. Ábrelo en este dispositivo y volverás aquí con la sesión iniciada.</p>
    </div>
  )
  return (
    <form onSubmit={submit} className="space-y-3">
      {note && <p className="text-noche-600">{note}</p>}
      <label className="block">
        <span className="text-sm font-bold">Tu email</span>
        <input
          type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
          className="mt-1 h-12 w-full rounded-xl border-2 border-noche/15 bg-white px-4 text-base outline-none focus:border-noche"
        />
      </label>
      <Button type="submit" className="w-full" disabled={state === 'sending'}>{state === 'sending' ? 'Enviando…' : supabase ? 'Enviarme un enlace de acceso' : 'Entrar'}</Button>
      {state === 'error' && <p className="text-sm font-semibold text-coral-700" role="alert">{err}</p>}
      <p className="text-xs text-noche-600">{supabase ? 'Sin contraseñas: te llega un enlace por email.' : 'Modo demo: la cuenta y los planes se guardan solo en este navegador.'}</p>
    </form>
  )
}
