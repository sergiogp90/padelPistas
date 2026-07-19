import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CalendarRange, ClipboardList, LayoutGrid, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, ApiError } from '@/api/client'
import type { Torneo, TorneoCategoria } from '@/api/types'
import { mensajeError } from '@/lib/errores'
import { etiquetaCategoria, formatearRango } from '@/lib/torneos'
import { CategoriaDialog, TorneoDialog } from './torneo-dialogs'

function Dato({ icono, etiqueta, valor }: { icono: React.ReactNode; etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-muted-foreground">{icono}</span>
      <div>
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <p className="text-sm font-medium">{valor}</p>
      </div>
    </div>
  )
}

export function TorneoDetallePage() {
  const { id } = useParams()
  const torneoId = Number(id)
  const [torneo, setTorneo] = useState<Torneo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [editandoTorneo, setEditandoTorneo] = useState(false)
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const [editandoCategoria, setEditandoCategoria] = useState<TorneoCategoria | null>(null)

  const cargar = useCallback(async () => {
    try {
      setTorneo(await api.getTorneo(torneoId))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNoEncontrado(true)
      else toast.error('No se pudo cargar el torneo')
    } finally {
      setCargando(false)
    }
  }, [torneoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function borrarCategoria(categoria: TorneoCategoria) {
    if (!window.confirm(`¿Eliminar la categoría "${etiquetaCategoria(categoria)}" y sus inscripciones?`))
      return
    try {
      await api.borrarCategoria(torneoId, categoria.id)
      toast.success('Categoría eliminada')
      cargar()
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar la categoría'))
    }
  }

  if (cargando) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  if (noEncontrado || !torneo) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-muted-foreground">Este torneo ya no existe.</p>
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
          <Button render={<Link to="/torneos" />} variant="ghost" size="icon-sm" title="Volver a torneos">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">{torneo.nombre}</h1>
            <p className="text-sm text-muted-foreground">Categorías e inscripciones del torneo</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditandoTorneo(true)}>
          <Pencil /> Editar torneo
        </Button>
      </div>

      <div className="card-seccion grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Dato
          icono={<CalendarRange className="size-4" />}
          etiqueta="Fechas de juego"
          valor={formatearRango(torneo.fechaInicio, torneo.fechaFin)}
        />
        <Dato
          icono={<ClipboardList className="size-4" />}
          etiqueta="Plazo de inscripción"
          valor={formatearRango(torneo.inscripcionApertura, torneo.inscripcionCierre)}
        />
        <Dato
          icono={<LayoutGrid className="size-4" />}
          etiqueta="Pistas disponibles"
          valor={String(torneo.pistasDisponibles)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Categorías</h2>
        <Button size="sm" onClick={() => setCreandoCategoria(true)}>
          <Plus /> Nueva categoría
        </Button>
      </div>

      <div className="card-seccion overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {torneo.categorias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                  Sin categorías todavía. Crea la primera (por ejemplo, Tercera — Masculino).
                </TableCell>
              </TableRow>
            ) : (
              torneo.categorias.map((categoria) => (
                <TableRow key={categoria.id}>
                  <TableCell>
                    <Link to={`/torneos/${torneo.id}/categorias/${categoria.id}`} title="Ver inscripciones">
                      <Badge variant="outline">{etiquetaCategoria(categoria)}</Badge>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        render={<Link to={`/torneos/${torneo.id}/categorias/${categoria.id}`} />}
                        variant="ghost"
                        size="icon-sm"
                        title="Inscripciones"
                      >
                        <Users />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Editar"
                        onClick={() => setEditandoCategoria(categoria)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Eliminar"
                        onClick={() => borrarCategoria(categoria)}
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

      <TorneoDialog
        open={editandoTorneo}
        torneo={torneo}
        onOpenChange={setEditandoTorneo}
        onHecho={cargar}
      />
      <CategoriaDialog
        open={creandoCategoria || editandoCategoria !== null}
        torneoId={torneo.id}
        categoria={editandoCategoria}
        onOpenChange={(open) => {
          if (!open) {
            setCreandoCategoria(false)
            setEditandoCategoria(null)
          }
        }}
        onHecho={cargar}
      />
    </div>
  )
}
