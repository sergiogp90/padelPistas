import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
import { api } from '@/api/client'
import type { Torneo } from '@/api/types'
import { mensajeError } from '@/lib/errores'
import { formatearRango } from '@/lib/torneos'
import { TorneoDialog } from './torneo-dialogs'

export function TorneosPage() {
  const [torneos, setTorneos] = useState<Torneo[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Torneo | null>(null)

  const cargar = useCallback(async () => {
    try {
      setTorneos(await api.getTorneos())
    } catch {
      toast.error('No se pudieron cargar los torneos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function borrar(torneo: Torneo) {
    if (!window.confirm(`¿Eliminar el torneo "${torneo.nombre}" con sus categorías e inscripciones?`)) return
    try {
      await api.borrarTorneo(torneo.id)
      toast.success('Torneo eliminado')
      cargar()
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar el torneo'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Torneos</h1>
          <p className="text-sm text-muted-foreground">Organiza los torneos del club y sus categorías</p>
        </div>
        <Button size="sm" onClick={() => setCreando(true)}>
          <Plus /> Nuevo torneo
        </Button>
      </div>

      <div className="card-seccion overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Torneo</TableHead>
              <TableHead>Fechas de juego</TableHead>
              <TableHead>Inscripción</TableHead>
              <TableHead className="text-center">Pistas</TableHead>
              <TableHead className="text-center">Categorías</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : torneos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No hay torneos todavía. Crea el primero.
                </TableCell>
              </TableRow>
            ) : (
              torneos.map((torneo) => (
                <TableRow key={torneo.id}>
                  <TableCell className="font-medium">{torneo.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatearRango(torneo.fechaInicio, torneo.fechaFin)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatearRango(torneo.inscripcionApertura, torneo.inscripcionCierre)}
                  </TableCell>
                  <TableCell className="text-center">{torneo.pistasDisponibles}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={torneo.categorias.length > 0 ? 'default' : 'outline'}>
                      {torneo.categorias.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Editar"
                        onClick={() => setEditando(torneo)}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Eliminar" onClick={() => borrar(torneo)}>
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
        open={creando || editando !== null}
        torneo={editando}
        onOpenChange={(open) => {
          if (!open) {
            setCreando(false)
            setEditando(null)
          }
        }}
        onHecho={cargar}
      />
    </div>
  )
}
