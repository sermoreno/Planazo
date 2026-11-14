import { lazy, Suspense } from 'react'
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { Header } from '@/components/Header'
import { NotFound } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import Landing from '@/pages/Landing'
import PlanPage from '@/pages/PlanPage'
import NewPlan from '@/pages/NewPlan'
import Credits from '@/pages/Credits'
import Explore from '@/pages/Explore'
import MyPlans from '@/pages/MyPlans'
import SharedPlan from '@/pages/SharedPlan'
import Account from '@/pages/Account'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import { AuthEvents, RequireAdmin, RequireAuth } from '@/components/auth/RequireAuth'

// El panel de admin va en un archivo aparte: solo se descarga si eres admin.
const Admin = lazy(() => import('@/pages/Admin'))

// La vista previa (Artifact) usa rutas en memoria; en producción, rutas limpias (/p/:share_slug).
const Router = import.meta.env.VITE_PREVIEW ? MemoryRouter : BrowserRouter

export default function App() {
  return (
    <Router basename={import.meta.env.VITE_PREVIEW ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <Header />
      <AuthEvents />
      <Routes>
        {/* Públicas: portada, acceso, créditos y planes compartidos por enlace */}
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/recuperar" element={<ForgotPassword />} />
        <Route path="/restablecer" element={<ResetPassword />} />
        <Route path="/p/:share_slug" element={<SharedPlan />} />
        <Route path="/creditos" element={<Credits />} />
        {/* Privadas: piden sesión */}
        <Route path="/plan/nuevo" element={<RequireAuth><NewPlan /></RequireAuth>} />
        <Route path="/plan/:id" element={<RequireAuth><PlanPage /></RequireAuth>} />
        <Route path="/explorar" element={<RequireAuth><Explore /></RequireAuth>} />
        <Route path="/mis-planes" element={<RequireAuth><MyPlans /></RequireAuth>} />
        <Route path="/cuenta" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><RequireAdmin><Suspense fallback={<div className="mx-auto max-w-4xl space-y-3 px-4 py-10"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24" /></div>}><Admin /></Suspense></RequireAdmin></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}
