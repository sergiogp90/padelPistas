import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Campo } from '@/components/ui/campo'
import { api } from '@/api/client'
import type { Jugador } from '@/api/types'
import { mensajeError } from '@/lib/errores'
import { parsearTelefonos } from '@/lib/jugadores'

/** Alta y edición de un jugador (`jugador === null` es alta). */
export function JugadorDialog({
  open,
  jugador,
  onOpenChange,
  onHecho,
}: {
  open: boolean
  jugador: Jugador | null
  onOpenChange: (open: boolean) => void
  onHecho: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefonos, setTelefonos] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) {
      setNombre(jugador?.nombre ?? '')
      setTelefonos(jugador?.telefonos.join(', ') ?? '')
    }
  }, [open, jugador])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      const lista = parsearTelefonos(telefonos)
      if (jugador) {
        await api.actualizarJugador(jugador.id, nombre.trim(), lista)
        toast.success('Jugador actualizado')
      } else {
        await api.crearJugador(nombre.trim(), lista)
        toast.success('Jugador creado')
      }
      onHecho()
      onOpenChange(false)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar el jugador'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{jugador ? `Editar ${jugador.nombre}` : 'Nuevo jugador'}</DialogTitle>
          <DialogDescription>Datos de contacto del jugador.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Campo label="Nombre" htmlFor="jugador-nombre">
            <Input
              id="jugador-nombre"
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellidos"
              required
            />
          </Campo>
          <Campo
            label="Teléfonos"
            htmlFor="jugador-telefonos"
            ayuda="Varios teléfonos separados por comas."
          >
            <Input
              id="jugador-telefonos"
              value={telefonos}
              onChange={(e) => setTelefonos(e.target.value)}
              placeholder="600111222, 911223344"
            />
          </Campo>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : jugador ? 'Guardar cambios' : 'Crear jugador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
