import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Pencil, Phone, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ApiError } from '@/api/client'
import type { HistorialJugador, HistorialTorneo } from '@/api/types'
import { etiquetaCategoria } from '@/lib/torneos'
import { nombreEstado, varianteEstado } from '@/lib/inscripciones'
import { resumenPartidos } from '@/lib/jugadores'
import { JugadorDialog } from './jugador-dialogs'

function TorneoDelHistorial({ torneo }: { torneo: HistorialTorneo }) {
  const ganados = torneo.partidos.filter((p) => p.ganado === true).length
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/torneos/${torneo.torneoId}`} className="font-medium hover:underline">
          {torneo.torneoNombre}
        </Link>
        <Badge variant="outline">{etiquetaCategoria(torneo.categoria)}</Badge>
        <Badge variant={varianteEstado(torneo.estado)}>{nombreEstado(torneo.estado)}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {resumenPartidos(torneo.partidos.length, ganados)}
        </span>
      </div>
      {torneo.partidos.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {torneo.partidos.map((partido) => (
            <li key={partido.id} className="flex items-center gap-2 text-sm">
              <Trophy
                className={
                  partido.ganado === true
                    ? 'size-3.5 text-primary'
                    : 'size-3.5 text-muted-foreground/40'
                }
              />
              <span>contra {partido.rivales.join(' y ')}</span>
              <span className="text-muted-foreground">
                {partido.resultado ?? 'sin jugar'}
                {partido.ganado === false && ' · perdido'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function JugadorPage() {
  const { id } = useParams()
  const jugadorId = Number(id)
  const [historial, setHistorial] = useState<HistorialJugador | null>(null)
  const [telefonos, setTelefonos] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [editando, setEditando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [datos, historico] = await Promise.all([
        api.getJugador(jugadorId),
        api.getHistorialJugador(jugadorId),
      ])
      setTelefonos(datos.telefonos)
      setHistorial(historico)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNoEncontrado(true)
      else toast.error('No se pudo cargar el jugador')
    } finally {
      setCargando(false)
    }
  }, [jugadorId])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (cargando) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  if (noEncontrado || !historial) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-muted-foreground">Este jugador ya no existe.</p>
        <Button render={<Link to="/jugadores" />} variant="outline" size="sm">
          <ArrowLeft /> Volver a jugadores
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button render={<Link to="/jugadores" />} variant="ghost" size="icon-sm" title="Volver a jugadores">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">{historial.nombre}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5" />
              {telefonos.join(' · ') || 'Sin teléfonos'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
          <Pencil /> Editar
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Torneos</h2>
        <span className="text-sm text-muted-foreground">
          {historial.torneos.length} torneo{historial.torneos.length === 1 ? '' : 's'}
        </span>
      </div>

      {historial.torneos.length === 0 ? (
        <div className="card-seccion py-8 text-center text-sm text-muted-foreground">
          Todavía no ha participado en ningún torneo.
        </div>
      ) : (
        <div className="card-seccion divide-y divide-border overflow-hidden">
          {historial.torneos.map((torneo) => (
            <TorneoDelHistorial key={`${torneo.torneoId}-${torneo.categoria.id}`} torneo={torneo} />
          ))}
        </div>
      )}

      <JugadorDialog
        open={editando}
        jugador={{ id: historial.id, nombre: historial.nombre, telefonos }}
        onOpenChange={setEditando}
        onHecho={cargar}
      />
    </div>
  )
}
