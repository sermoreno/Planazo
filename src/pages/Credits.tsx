import { allCredits } from '@/lib/photos'

export default function Credits() {
  const list = allCredits()
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Créditos</h1>
      <p className="mt-2 text-noche-600">Todas las fotos son de Wikimedia Commons y se usan con su licencia libre. Pulsa en cada una para ver la ficha original.</p>
      <p className="mt-3 rounded-card bg-white p-3 text-[15px] shadow-soft">La previsión del tiempo es de <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2">Open-Meteo.com</a> (datos con licencia <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline underline-offset-2">CC BY 4.0</a>). Los mapas son de © colaboradores de OpenStreetMap.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {list.map((p) => (
          <li key={p.k}>
            <a href={p.page} target="_blank" rel="noreferrer" className="flex gap-3 rounded-card bg-white p-2.5 shadow-soft hover:ring-2 hover:ring-noche/20">
              <img src={p.src} alt="" loading="lazy" className="h-16 w-20 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 text-sm">
                <span className="block truncate font-bold">{p.title.replace(/^File:/, '').replace(/\.\w+$/, '')}</span>
                <span className="block truncate text-noche-600">{p.artist || 'Autor desconocido'}</span>
                <span className="block text-xs font-semibold text-coral-700">{p.license}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
