import { useEffect, useMemo, useState } from 'react'
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
import { api } from '@/api/client'
import type { Inscripcion, Torneo } from '@/api/types'
import { mensajeError } from '@/lib/errores'
import { cn } from '@/lib/utils'
import {
  claveSlot,
  diasDelTorneo,
  etiquetaDia,
  horasDelDia,
  setDesdeSlots,
  slotsDesdeSet,
} from '@/lib/disponibilidad'

/**
 * Rejilla días del torneo × franjas horarias donde se marca cuándo puede jugar
 * la pareja. Servirá de base al futuro sorteo de turnos. Se edita en local y se
 * guarda entera con el botón (un solo PUT), no celda a celda.
 */
export function DisponibilidadDialog({
  inscripcion,
  torneo,
  onOpenChange,
  onHecho,
}: {
  inscripcion: Inscripcion | null
  torneo: Torneo
  onOpenChange: (open: boolean) => void
  onHecho: () => void
}) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  const dias = useMemo(() => diasDelTorneo(torneo.fechaInicio, torneo.fechaFin), [torneo])
  const horas = horasDelDia()

  useEffect(() => {
    if (inscripcion) setMarcadas(setDesdeSlots(inscripcion.disponibilidad))
  }, [inscripcion])

  function alternar(clave: string) {
    setMarcadas((prev) => {
      const copia = new Set(prev)
      if (copia.has(clave)) copia.delete(clave)
      else copia.add(clave)
      return copia
    })
  }

  async function guardar() {
    if (!inscripcion) return
    setGuardando(true)
    try {
      await api.guardarDisponibilidad(inscripcion.id, slotsDesdeSet(marcadas))
      toast.success('Disponibilidad guardada')
      onHecho()
      onOpenChange(false)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar la disponibilidad'))
    } finally {
      setGuardando(false)
    }
  }

  const pareja = inscripcion ? `${inscripcion.jugador1.nombre} y ${inscripcion.jugador2.nombre}` : ''

  return (
    <Dialog open={inscripcion !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Disponibilidad · {pareja}</DialogTitle>
          <DialogDescription>
            Marca las horas a las que la pareja puede jugar durante el torneo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-background p-2" aria-label="Hora" />
                {dias.map((dia) => (
                  <th key={dia} className="sticky top-0 z-10 bg-background p-2 font-medium capitalize">
                    {etiquetaDia(dia)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horas.map((hora) => (
                <tr key={hora}>
                  <th className="sticky left-0 z-10 bg-background p-1.5 pr-2 text-right font-normal text-muted-foreground">
                    {hora}:00
                  </th>
                  {dias.map((dia) => {
                    const clave = claveSlot(dia, hora)
                    const activa = marcadas.has(clave)
                    return (
                      <td key={clave} className="p-0.5">
                        <button
                          type="button"
                          aria-pressed={activa}
                          aria-label={`${etiquetaDia(dia)} ${hora}:00`}
                          onClick={() => alternar(clave)}
                          className={cn(
                            'h-6 w-full min-w-9 rounded-sm border transition-colors',
                            activa
                              ? 'border-primary bg-primary'
                              : 'border-border bg-muted/40 hover:bg-muted',
                          )}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {marcadas.size === 0 ? 'Sin franjas marcadas' : `${marcadas.size} franja${marcadas.size === 1 ? '' : 's'}`}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
