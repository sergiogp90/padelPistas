import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/api/client'
import type { Jugador } from '@/api/types'
import { mensajeError } from '@/lib/errores'
import { JugadorDialog } from './jugador-dialogs'

const RETARDO_BUSQUEDA_MS = 300

export function JugadoresPage() {
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Jugador | null>(null)

  const cargar = useCallback(async (termino: string) => {
    try {
      setJugadores(await api.buscarJugadores(termino.trim()))
    } catch {
      toast.error('No se pudieron cargar los jugadores')
    } finally {
      setCargando(false)
    }
  }, [])

  // Primera carga inmediata; al teclear, con retardo.
  useEffect(() => {
    if (busqueda === '') {
      cargar('')
      return
    }
    const timer = setTimeout(() => cargar(busqueda), RETARDO_BUSQUEDA_MS)
    return () => clearTimeout(timer)
  }, [busqueda, cargar])

  async function borrar(jugador: Jugador) {
    if (!window.confirm(`¿Eliminar a "${jugador.nombre}"?`)) return
    try {
      await api.borrarJugador(jugador.id)
      toast.success('Jugador eliminado')
      cargar(busqueda)
    } catch (err) {
      // El 409 explica que tiene inscripciones y no se puede borrar.
      toast.error(mensajeError(err, 'No se pudo eliminar el jugador'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Jugadores</h1>
          <p className="text-sm text-muted-foreground">Los jugadores del club y su histórico de torneos</p>
        </div>
        <Button size="sm" onClick={() => setCreando(true)}>
          <Plus /> Nuevo jugador
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar jugadores"
          className="pl-8"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
        />
      </div>

      <div className="card-seccion overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jugador</TableHead>
              <TableHead>Teléfonos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : jugadores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay jugadores todavía.'}
                </TableCell>
              </TableRow>
            ) : (
              jugadores.map((jugador) => (
                <TableRow key={jugador.id}>
                  <TableCell className="font-medium">
                    <Link to={`/jugadores/${jugador.id}`} className="hover:underline">
                      {jugador.nombre}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {jugador.telefonos.join(' · ') || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Editar"
                        onClick={() => setEditando(jugador)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Eliminar"
                        onClick={() => borrar(jugador)}
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

      <JugadorDialog
        open={creando || editando !== null}
        jugador={editando}
        onOpenChange={(open) => {
          if (!open) {
            setCreando(false)
            setEditando(null)
          }
        }}
        onHecho={() => cargar(busqueda)}
      />
    </div>
  )
}
