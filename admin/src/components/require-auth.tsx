import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { api } from '@/api/client'

type Estado = 'cargando' | 'autenticado' | 'anonimo'

/** Protege las rutas del admin: comprueba la sesión contra /api/auth/me. */
export function RequireAuth() {
  const [estado, setEstado] = useState<Estado>('cargando')

  useEffect(() => {
    let vigente = true
    api
      .me()
      .then(() => vigente && setEstado('autenticado'))
      .catch(() => vigente && setEstado('anonimo'))
    return () => {
      vigente = false
    }
  }, [])

  if (estado === 'cargando') {
    return <div className="p-8 text-sm text-muted-foreground">Comprobando sesión…</div>
  }
  if (estado === 'anonimo') return <Navigate to="/login" replace />
  return <Outlet />
}
