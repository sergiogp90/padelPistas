import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/require-auth'
import { AppLayout } from '@/components/app-layout'
import { LoginPage } from '@/pages/LoginPage'
import { CourtsPage } from '@/pages/CourtsPage'
import { TorneosPage } from '@/pages/TorneosPage'
import { TorneoDetallePage } from '@/pages/TorneoDetallePage'
import { CategoriaPage } from '@/pages/CategoriaPage'
import { JugadoresPage } from '@/pages/JugadoresPage'
import { JugadorPage } from '@/pages/JugadorPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<CourtsPage />} />
          <Route path="/torneos" element={<TorneosPage />} />
          <Route path="/torneos/:id" element={<TorneoDetallePage />} />
          <Route path="/torneos/:id/categorias/:categoriaId" element={<CategoriaPage />} />
          <Route path="/jugadores" element={<JugadoresPage />} />
          <Route path="/jugadores/:id" element={<JugadorPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
