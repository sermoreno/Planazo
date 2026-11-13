import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import Landing from '@/pages/Landing'
import PlanPage from '@/pages/PlanPage'
import NewPlan from '@/pages/NewPlan'
import Credits from '@/pages/Credits'
import Explore from '@/pages/Explore'

// La vista previa (Artifact) usa rutas en memoria; en producción, rutas limpias (/p/:share_slug).
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : BrowserRouter
const Soon = ({ what }: { what: string }) => <EmptyState title={what} text="Esta pantalla llega en el siguiente hito del prototipo." cta={{ to: '/plan/demo', label: 'Ver el plan de ejemplo' }} />

export default function App() {
  return (
    <Router basename={import.meta.env.VITE_PREVIEW ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/plan/nuevo" element={<NewPlan />} />
        <Route path="/plan/:id" element={<PlanPage />} />
        <Route path="/mis-planes" element={<Soon what="Mis planes" />} />
        <Route path="/p/:share_slug" element={<Soon what="Plan compartido" />} />
        <Route path="/cuenta" element={<Soon what="Cuenta" />} />
        <Route path="/explorar" element={<Explore />} />
        <Route path="/creditos" element={<Credits />} />
        <Route path="*" element={<EmptyState title="Página no encontrada" text="Vuelve al inicio y crea tu plan." cta={{ to: '/', label: 'Ir al inicio' }} />} />
      </Routes>
    </Router>
  )
}
