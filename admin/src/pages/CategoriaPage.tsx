import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CalendarClock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, ApiError } from '@/api/client'
import type { Inscripcion, InscripcionEstado, Jugador, Torneo } from '@/api/types'
import { mensajeError } from '@/lib/errores'
import { etiquetaCategoria } from '@/lib/torneos'
import { ESTADOS, nombreEstado, varianteEstado } from '@/lib/inscripciones'
import { InscribirParejaDialog } from './inscripcion-dialogs'
import { DisponibilidadDialog } from './disponibilidad-dialog'

const selectClass =
  'h-7 rounded-lg border border-input bg-transparent px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function NombresPareja({ jugador1, jugador2 }: { jugador1: Jugador; jugador2: Jugador }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium">
        <Link to={`/jugadores/${jugador1.id}`} className="hover:underline" title={`Ficha de ${jugador1.nombre}`}>
          {jugador1.nombre}
        </Link>
        {' · '}
        <Link to={`/jugadores/${jugador2.id}`} className="hover:underline" title={`Ficha de ${jugador2.nombre}`}>
          {jugador2.nombre}
        </Link>
      </span>
      <span className="text-xs text-muted-foreground">
        {[...jugador1.telefonos, ...jugador2.telefonos].join(' · ') || 'Sin teléfonos'}
      </span>
    </div>
  )
}

export function CategoriaPage() {
  const { id, categoriaId } = useParams()
  const torneoId = Number(id)
  const catId = Number(categoriaId)
  const [torneo, setTorneo] = useState<Torneo | null>(null)
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [inscribiendo, setInscribiendo] = useState(false)
  const [editandoDisponibilidad, setEditandoDisponibilidad] = useState<Inscripcion | null>(null)

  const cargar = useCallback(async () => {
    try {
      const [torneoCargado, lista] = await Promise.all([
        api.getTorneo(torneoId),
        api.getInscripciones(catId),
      ])
      setTorneo(torneoCargado)
      setInscripciones(lista)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNoEncontrado(true)
      else toast.error('No se pudieron cargar las inscripciones')
    } finally {
      setCargando(false)
    }
  }, [torneoId, catId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const categoria = torneo?.categorias.find((c) => c.id === catId)

  async function cambiarEstado(inscripcion: Inscripcion, estado: InscripcionEstado) {
    // Optimista: el select refleja el cambio ya; si falla, se recarga.
    setInscripciones((prev) => prev.map((i) => (i.id === inscripcion.id ? { ...i, estado } : i)))
    try {
      await api.cambiarEstadoInscripcion(inscripcion.id, estado)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo cambiar el estado'))
      cargar()
    }
  }

  async function cambiarPago(inscripcion: Inscripcion, pagada: boolean) {
    setInscripciones((prev) => prev.map((i) => (i.id === inscripcion.id ? { ...i, pagada } : i)))
    try {
      await api.cambiarPagoInscripcion(inscripcion.id, pagada)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo cambiar el pago'))
      cargar()
    }
  }

  async function borrar(inscripcion: Inscripcion) {
    const pareja = `${inscripcion.jugador1.nombre} y ${inscripcion.jugador2.nombre}`
    if (!window.confirm(`¿Eliminar la inscripción de ${pareja}? Para conservarla, usa el estado "retirada".`))
      return
    try {
      await api.borrarInscripcion(inscripcion.id)
      toast.success('Inscripción eliminada')
      cargar()
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar la inscripción'))
    }
  }

  if (cargando) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  if (noEncontrado || !torneo || !categoria) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-muted-foreground">Esta categoría ya no existe.</p>
        <Button render={<Link to="/torneos" />} variant="outline" size="sm">
          <ArrowLeft /> Volver a torneos
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            render={<Link to={`/torneos/${torneo.id}`} />}
            variant="ghost"
            size="icon-sm"
            title={`Volver a ${torneo.nombre}`}
          >
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {etiquetaCategoria(categoria)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {torneo.nombre} · {inscripciones.length} pareja{inscripciones.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setInscribiendo(true)}>
          <Plus /> Inscribir pareja
        </Button>
      </div>

      <div className="card-seccion overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pareja</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Disponibilidad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inscripciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Sin parejas inscritas todavía.
                </TableCell>
              </TableRow>
            ) : (
              inscripciones.map((inscripcion) => (
                <TableRow key={inscripcion.id}>
                  <TableCell>
                    <NombresPareja jugador1={inscripcion.jugador1} jugador2={inscripcion.jugador2} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={varianteEstado(inscripcion.estado)}>
                        {nombreEstado(inscripcion.estado)}
                      </Badge>
                      <select
                        aria-label={`Estado de ${inscripcion.jugador1.nombre} y ${inscripcion.jugador2.nombre}`}
                        className={selectClass}
                        value={inscripcion.estado}
                        onChange={(e) => cambiarEstado(inscripcion, e.target.value as InscripcionEstado)}
                      >
                        {ESTADOS.map((estado) => (
                          <option key={estado} value={estado}>
                            {nombreEstado(estado)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={inscripcion.pagada}
                        onCheckedChange={(pagada) => cambiarPago(inscripcion, pagada)}
                        aria-label={`Pago de ${inscripcion.jugador1.nombre} y ${inscripcion.jugador2.nombre}`}
                      />
                      {inscripcion.pagada ? 'Pagada' : 'No pagada'}
                    </label>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      title="Editar disponibilidad"
                      onClick={() => setEditandoDisponibilidad(inscripcion)}
                    >
                      <CalendarClock />
                      {inscripcion.disponibilidad.length > 0
                        ? `${inscripcion.disponibilidad.length} franja${inscripcion.disponibilidad.length === 1 ? '' : 's'}`
                        : 'Sin marcar'}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Eliminar inscripción"
                        onClick={() => borrar(inscripcion)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <InscribirParejaDialog
        open={inscribiendo}
        categoriaId={catId}
        onOpenChange={setInscribiendo}
        onHecho={cargar}
      />
      <DisponibilidadDialog
        inscripcion={editandoDisponibilidad}
        torneo={torneo}
        onOpenChange={(open) => !open && setEditandoDisponibilidad(null)}
        onHecho={cargar}
      />
    </div>
  )
}
