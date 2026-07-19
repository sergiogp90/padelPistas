import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Ban, Pencil, Plus, Trash2 } from 'lucide-react'
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
import type { ApiCourt } from '@/api/types'
import { CrearPistaDialog, PartidoDialog, RenombrarPistaDialog } from './court-dialogs'

const INTERVALO_REFRESCO_MS = 5000

export function CourtsPage() {
  const [courts, setCourts] = useState<ApiCourt[]>([])
  const [cargando, setCargando] = useState(true)
  const [crearAbierto, setCrearAbierto] = useState(false)
  const [renombrando, setRenombrando] = useState<ApiCourt | null>(null)
  const [editandoPartido, setEditandoPartido] = useState<ApiCourt | null>(null)

  const cargar = useCallback(async () => {
    try {
      setCourts(await api.getCourts())
    } catch {
      toast.error('No se pudieron cargar las pistas')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const id = setInterval(cargar, INTERVALO_REFRESCO_MS)
    return () => clearInterval(id)
  }, [cargar])

  async function liberar(court: ApiCourt) {
    try {
      await api.clearMatch(court.id)
      toast.success(`${court.name} liberada`)
      cargar()
    } catch {
      toast.error('No se pudo liberar la pista')
    }
  }

  async function borrar(court: ApiCourt) {
    if (!window.confirm(`¿Eliminar la pista "${court.name}"?`)) return
    try {
      await api.deleteCourt(court.id)
      toast.success('Pista eliminada')
      cargar()
    } catch {
      toast.error('No se pudo eliminar la pista')
    }
  }

  async function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion
    if (destino < 0 || destino >= courts.length) return
    const orden = courts.map((c) => c.id)
    ;[orden[indice], orden[destino]] = [orden[destino], orden[indice]]
    // Optimista: reordena en local y confirma contra el servidor.
    setCourts((prev) => {
      const copia = [...prev]
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })
    try {
      await api.reorder(orden)
    } catch {
      toast.error('No se pudo reordenar')
      cargar()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Pistas</h1>
          <p className="text-sm text-muted-foreground">Configura las pistas y su partido en curso</p>
        </div>
        <Button size="sm" onClick={() => setCrearAbierto(true)}>
          <Plus /> Nueva pista
        </Button>
      </div>

      <div className="card-seccion overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Pista</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : courts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No hay pistas todavía. Crea la primera.
                </TableCell>
              </TableRow>
            ) : (
              courts.map((court, i) => (
                <TableRow key={court.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{court.name}</TableCell>
                  <TableCell>
                    {court.match ? (
                      <Badge variant="default">En juego</Badge>
                    ) : (
                      <Badge variant="outline">Libre</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Subir"
                        disabled={i === 0}
                        onClick={() => mover(i, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Bajar"
                        disabled={i === courts.length - 1}
                        onClick={() => mover(i, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditandoPartido(court)}>
                        Partido
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Liberar pista"
                        disabled={!court.match}
                        onClick={() => liberar(court)}
                      >
                        <Ban />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Renombrar"
                        onClick={() => setRenombrando(court)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Eliminar"
                        onClick={() => borrar(court)}
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

      <CrearPistaDialog open={crearAbierto} onOpenChange={setCrearAbierto} onCreada={cargar} />
      <RenombrarPistaDialog
        court={renombrando}
        onOpenChange={(open) => !open && setRenombrando(null)}
        onHecho={cargar}
      />
      <PartidoDialog
        court={editandoPartido}
        onOpenChange={(open) => !open && setEditandoPartido(null)}
        onHecho={cargar}
      />
    </div>
  )
}
