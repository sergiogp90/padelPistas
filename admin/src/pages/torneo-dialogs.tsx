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
import { SelectorFecha } from '@/components/ui/selector-fecha'
import { api } from '@/api/client'
import type { GuardarTorneo, Torneo, TorneoCategoria, TorneoGenero } from '@/api/types'
import { mensajeError } from '@/lib/errores'
import {
  NIVELES_DISPONIBLES,
  construirTorneo,
  etiquetaCategoria,
  fechaLocal,
  nombreNivel,
  validarTorneo,
  type TorneoFormValues,
} from '@/lib/torneos'

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * Alta y edición de un torneo en un mismo diálogo (`torneo === null` es alta).
 * El formulario es no-controlado (SelectorFecha publica su valor en un input
 * oculto), así que se lee entero con FormData al enviar; el `key` sobre el form
 * lo remonta al cambiar de torneo para refrescar los valores por defecto.
 */
export function TorneoDialog({
  open,
  torneo,
  onOpenChange,
  onHecho,
}: {
  open: boolean
  torneo: Torneo | null
  onOpenChange: (open: boolean) => void
  onHecho: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(cuerpo: GuardarTorneo) {
    setGuardando(true)
    try {
      if (torneo) {
        await api.actualizarTorneo(torneo.id, cuerpo)
        toast.success('Torneo actualizado')
      } else {
        await api.crearTorneo(cuerpo)
        toast.success('Torneo creado')
      }
      onHecho()
      onOpenChange(false)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar el torneo'))
    } finally {
      setGuardando(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const valores: TorneoFormValues = {
      nombre: String(data.get('nombre') ?? ''),
      fechaInicio: String(data.get('fechaInicio') ?? ''),
      fechaFin: String(data.get('fechaFin') ?? ''),
      inscripcionApertura: String(data.get('inscripcionApertura') ?? ''),
      inscripcionCierre: String(data.get('inscripcionCierre') ?? ''),
      pistasDisponibles: Number(data.get('pistasDisponibles') ?? 0),
    }
    const problema = validarTorneo(valores)
    if (problema) {
      setError(problema)
      return
    }
    setError(null)
    guardar(construirTorneo(valores))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(abierto) => {
        if (!abierto) setError(null)
        onOpenChange(abierto)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{torneo ? `Editar ${torneo.nombre}` : 'Nuevo torneo'}</DialogTitle>
          <DialogDescription>
            {torneo
              ? 'Cambia los datos del torneo; las categorías se gestionan desde su detalle.'
              : 'Define las fechas de juego, el plazo de inscripción y las pistas reservadas.'}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <form
            key={torneo?.id ?? 'nuevo'}
            onSubmit={onSubmit}
            className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
          >
            <Campo label="Nombre" htmlFor="torneo-nombre">
              <Input
                id="torneo-nombre"
                name="nombre"
                autoFocus
                defaultValue={torneo?.nombre ?? ''}
                placeholder="Open de Otoño"
                required
              />
            </Campo>

            <div className="grid grid-cols-2 gap-4">
              <Campo label="Inicio del torneo" htmlFor="torneo-inicio">
                <SelectorFecha
                  id="torneo-inicio"
                  name="fechaInicio"
                  defaultValue={torneo ? fechaLocal(torneo.fechaInicio) : undefined}
                />
              </Campo>
              <Campo label="Fin del torneo" htmlFor="torneo-fin">
                <SelectorFecha
                  id="torneo-fin"
                  name="fechaFin"
                  defaultValue={torneo ? fechaLocal(torneo.fechaFin) : undefined}
                />
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Campo label="Apertura de inscripción" htmlFor="torneo-apertura">
                <SelectorFecha
                  id="torneo-apertura"
                  name="inscripcionApertura"
                  defaultValue={torneo ? fechaLocal(torneo.inscripcionApertura) : undefined}
                />
              </Campo>
              <Campo
                label="Cierre de inscripción"
                htmlFor="torneo-cierre"
                ayuda="El plazo cubre los días completos (00:00–23:59)."
              >
                <SelectorFecha
                  id="torneo-cierre"
                  name="inscripcionCierre"
                  defaultValue={torneo ? fechaLocal(torneo.inscripcionCierre) : undefined}
                />
              </Campo>
            </div>

            <Campo label="Pistas disponibles" htmlFor="torneo-pistas">
              <Input
                id="torneo-pistas"
                name="pistasDisponibles"
                type="number"
                min={1}
                defaultValue={torneo?.pistasDisponibles ?? 3}
                required
              />
            </Campo>

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
                {guardando ? 'Guardando…' : torneo ? 'Guardar cambios' : 'Crear torneo'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Alta y edición de una categoría (`categoria === null` es alta). La letra no se
 * elige aquí: la asigna el servidor según cuántas categorías del mismo nivel y
 * género existan, y puede cambiar la de una categoría ya creada (la primera pasa
 * a "A" al aparecer la "B"), por eso `onHecho` debe recargar el torneo entero.
 */
export function CategoriaDialog({
  open,
  torneoId,
  categoria,
  onOpenChange,
  onHecho,
}: {
  open: boolean
  torneoId: number
  categoria: TorneoCategoria | null
  onOpenChange: (open: boolean) => void
  onHecho: () => void
}) {
  const [nivel, setNivel] = useState(3)
  const [genero, setGenero] = useState<TorneoGenero>('masculino')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) {
      setNivel(categoria?.nivel ?? 3)
      setGenero(categoria?.genero ?? 'masculino')
    }
  }, [open, categoria])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setGuardando(true)
    try {
      if (categoria) {
        await api.actualizarCategoria(torneoId, categoria.id, nivel, genero)
        toast.success('Categoría actualizada')
      } else {
        const creada = await api.crearCategoria(torneoId, nivel, genero)
        toast.success(`Categoría ${etiquetaCategoria(creada)} creada`)
      }
      onHecho()
      onOpenChange(false)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar la categoría'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? `Editar ${etiquetaCategoria(categoria)}` : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>
            La letra (A, B…) se asigna sola cuando hay varias categorías del mismo nivel y género.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Nivel" htmlFor="categoria-nivel">
              <select
                id="categoria-nivel"
                className={selectClass}
                value={nivel}
                onChange={(e) => setNivel(Number(e.target.value))}
              >
                {NIVELES_DISPONIBLES.map((n) => (
                  <option key={n} value={n}>
                    {nombreNivel(n)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Género" htmlFor="categoria-genero">
              <select
                id="categoria-genero"
                className={selectClass}
                value={genero}
                onChange={(e) => setGenero(e.target.value as TorneoGenero)}
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="mixto">Mixto</option>
              </select>
            </Campo>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : categoria ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
