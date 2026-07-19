import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { MarcaClub } from '@/components/marca-club'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'

function EnlaceNav({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  )
}

/** Marco común de las páginas autenticadas: marca, navegación y sesión. */
export function AppLayout() {
  const navigate = useNavigate()

  async function salir() {
    try {
      await api.logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <MarcaClub />
          <nav aria-label="Secciones" className="flex items-center gap-1">
            <EnlaceNav to="/" end>
              Pistas
            </EnlaceNav>
            <EnlaceNav to="/torneos">Torneos</EnlaceNav>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button variant="outline" size="sm" onClick={salir}>
            <LogOut /> Salir
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
