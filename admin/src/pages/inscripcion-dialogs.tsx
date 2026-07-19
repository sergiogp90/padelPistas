import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { api } from '@/api/client'
import type { Jugador, JugadorRef } from '@/api/types'
import { mensajeError } from '@/lib/errores'
import { construirJugadorRef } from '@/lib/inscripciones'

const MIN_BUSQUEDA = 2
const RETARDO_BUSQUEDA_MS = 300

/**
 * Selector de un jugador para la pareja: buscador (nombre o teléfono) contra
 * /api/admin/players con retardo, o alta inline con nombre y teléfono. El
 * jugador elegido en el buscador manda sobre los campos de nuevo.
 */
function JugadorSelector({
  etiqueta,
  seleccionado,
  onSeleccionar,
  nombre,
  onNombre,
  telefono,
  onTelefono,
  excluirId,
}: {
  etiqueta: string
  seleccionado: Jugador | null
  onSeleccionar: (jugador: Jugador | null) => void
  nombre: string
  onNombre: (valor: string) => void
  telefono: string
  onTelefono: (valor: string) => void
  /** Jugador ya elegido en el otro selector, para no ofrecerlo dos veces. */
  excluirId?: number
}) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Jugador[]>([])

  useEffect(() => {
    const termino = busqueda.trim()
    if (termino.length < MIN_BUSQUEDA) {
      setResultados([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        setResultados(await api.buscarJugadores(termino))
      } catch {
        setResultados([])
      }
    }, RETARDO_BUSQUEDA_MS)
    return () => clearTimeout(timer)
  }, [busqueda])

  const candidatos = resultados.filter((j) => j.id !== excluirId).slice(0, 5)

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{etiqueta}</legend>

      {seleccionado ? (
        <div className="flex items-center gap-2">
          <Badge variant="default">{seleccionado.nombre}</Badge>
          <span className="text-xs text-muted-foreground">{seleccionado.telefonos.join(' · ')}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={`Quitar ${seleccionado.nombre}`}
            onClick={() => onSeleccionar(null)}
          >
            <X />
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={`Buscar ${etiqueta}`}
              className="pl-8"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
            />
          </div>
          {candidatos.length > 0 && (
            <ul className="flex flex-col overflow-hidden rounded-lg border border-border">
              {candidatos.map((jugador) => (
                <li key={jugador.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                    onClick={() => {
                      onSeleccionar(jugador)
                      setBusqueda('')
                    }}
                  >
                    <span>{jugador.nombre}</span>
                    <span className="text-xs text-muted-foreground">{jugador.telefonos.join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">…o crea uno nuevo:</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              aria-label={`Nombre nuevo ${etiqueta}`}
              value={nombre}
              onChange={(e) => onNombre(e.target.value)}
              placeholder="Nombre y apellidos"
            />
            <Input
              aria-label={`Teléfono nuevo ${etiqueta}`}
              className="w-36"
              value={telefono}
              onChange={(e) => onTelefono(e.target.value)}
              placeholder="Teléfono"
            />
          </div>
        </>
      )}
    </fieldset>
  )
}

export function InscribirParejaDialog({
  open,
  categoriaId,
  onOpenChange,
  onHecho,
}: {
  open: boolean
  categoriaId: number
  onOpenChange: (open: boolean) => void
  onHecho: () => void
}) {
  const [seleccionado1, setSeleccionado1] = useState<Jugador | null>(null)
  const [seleccionado2, setSeleccionado2] = useState<Jugador | null>(null)
  const [nombre1, setNombre1] = useState('')
  const [nombre2, setNombre2] = useState('')
  const [telefono1, setTelefono1] = useState('')
  const [telefono2, setTelefono2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) {
      setSeleccionado1(null)
      setSeleccionado2(null)
      setNombre1('')
      setNombre2('')
      setTelefono1('')
      setTelefono2('')
      setError(null)
    }
  }, [open])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()

    const ref1 = construirJugadorRef(seleccionado1?.id ?? null, nombre1, telefono1, 'jugador 1')
    if ('error' in ref1) return setError(ref1.error)
    const ref2 = construirJugadorRef(seleccionado2?.id ?? null, nombre2, telefono2, 'jugador 2')
    if ('error' in ref2) return setError(ref2.error)

    setError(null)
    setGuardando(true)
    try {
      await inscribir(ref1.ref, ref2.ref)
    } finally {
      setGuardando(false)
    }
  }

  async function inscribir(jugador1: JugadorRef, jugador2: JugadorRef) {
    try {
      const creada = await api.crearInscripcion(categoriaId, jugador1, jugador2)
      toast.success(`Pareja ${creada.jugador1.nombre} y ${creada.jugador2.nombre} inscrita`)
      onHecho()
      onOpenChange(false)
    } catch (err) {
      // El servidor explica el motivo (pareja duplicada, mismo jugador…).
      toast.error(mensajeError(err, 'No se pudo inscribir la pareja'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inscribir pareja</DialogTitle>
          <DialogDescription>
            Busca jugadores ya dados de alta o crea nuevos. La inscripción entra como pendiente y sin pagar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <JugadorSelector
            etiqueta="Jugador 1"
            seleccionado={seleccionado1}
            onSeleccionar={setSeleccionado1}
            nombre={nombre1}
            onNombre={setNombre1}
            telefono={telefono1}
            onTelefono={setTelefono1}
            excluirId={seleccionado2?.id}
          />
          <JugadorSelector
            etiqueta="Jugador 2"
            seleccionado={seleccionado2}
            onSeleccionar={setSeleccionado2}
            nombre={nombre2}
            onNombre={setNombre2}
            telefono={telefono2}
            onTelefono={setTelefono2}
            excluirId={seleccionado1?.id}
          />

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Inscribiendo…' : 'Inscribir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
