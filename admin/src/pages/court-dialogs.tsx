import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
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
import { Label } from '@/components/ui/label'
import { api, ApiError } from '@/api/client'
import type { ApiCourt, ApiGender, ApiPoint } from '@/api/types'
import {
  PUNTOS,
  construirPartido,
  etiquetaPunto,
  partidoAForm,
  validarPartido,
  type PartidoForm,
} from '@/lib/score'

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function mensajeError(err: unknown, porDefecto: string): string {
  if (err instanceof ApiError) return err.message || porDefecto
  return porDefecto
}

function Grupo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {children}
    </div>
  )
}

// ── Crear pista ────────────────────────────────────────────────────────────
export function CrearPistaDialog({
  open,
  onOpenChange,
  onCreada,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreada: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) setNombre('')
  }, [open])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      await api.createCourt(nombre.trim())
      toast.success('Pista creada')
      onCreada()
      onOpenChange(false)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo crear la pista'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva pista</DialogTitle>
          <DialogDescription>Añade una pista al club.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre-pista">Nombre</Label>
            <Input
              id="nombre-pista"
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Pista 4"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Renombrar pista ──────────────────────────────────────────────────────────
export function RenombrarPistaDialog({
  court,
  onOpenChange,
  onHecho,
}: {
  court: ApiCourt | null
  onOpenChange: (open: boolean) => void
  onHecho: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (court) setNombre(court.name)
  }, [court])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!court || !nombre.trim()) return
    setGuardando(true)
    try {
      await api.renameCourt(court.id, nombre.trim())
      toast.success('Pista renombrada')
      onHecho()
      onOpenChange(false)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo renombrar la pista'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={court !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar pista</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre-renombrar">Nombre</Label>
            <Input
              id="nombre-renombrar"
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Editar partido en curso ──────────────────────────────────────────────────
export function PartidoDialog({
  court,
  onOpenChange,
  onHecho,
}: {
  court: ApiCourt | null
  onOpenChange: (open: boolean) => void
  onHecho: () => void
}) {
  const [form, setForm] = useState<PartidoForm>(() => partidoAForm(null))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (court) {
      setForm(partidoAForm(court.match))
      setError(null)
    }
  }, [court])

  function setJugador(indice: number, campo: 'name' | 'gender', valor: string) {
    setForm((f) => {
      const jugadores = [...f.jugadores] as PartidoForm['jugadores']
      jugadores[indice] =
        campo === 'name'
          ? { ...jugadores[indice], name: valor }
          : { ...jugadores[indice], gender: valor as ApiGender }
      return { ...f, jugadores }
    })
  }

  function parsePunto(valor: string): ApiPoint {
    return valor === 'AD' ? 'AD' : (Number(valor) as ApiPoint)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!court) return
    const problema = validarPartido(form)
    if (problema) {
      setError(problema)
      return
    }
    setGuardando(true)
    try {
      await api.setMatch(court.id, construirPartido(form))
      toast.success('Partido actualizado')
      onHecho()
      onOpenChange(false)
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar el partido'))
    } finally {
      setGuardando(false)
    }
  }

  const equipos = [
    { titulo: 'Equipo 1', indices: [0, 1] },
    { titulo: 'Equipo 2', indices: [2, 3] },
  ]

  return (
    <Dialog open={court !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Partido en curso {court ? `· ${court.name}` : ''}</DialogTitle>
          <DialogDescription>Fija los jugadores y el marcador que se mostrará en la pista.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          {equipos.map((equipo) => (
            <fieldset key={equipo.titulo} className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground">{equipo.titulo}</legend>
              {equipo.indices.map((i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    aria-label={`Nombre jugador ${i + 1}`}
                    value={form.jugadores[i].name}
                    onChange={(e) => setJugador(i, 'name', e.target.value)}
                    placeholder={`Jugador ${i + 1}`}
                  />
                  <select
                    aria-label={`Género jugador ${i + 1}`}
                    className={selectClass}
                    value={form.jugadores[i].gender}
                    onChange={(e) => setJugador(i, 'gender', e.target.value)}
                  >
                    <option value="male">Masculino</option>
                    <option value="female">Femenino</option>
                  </select>
                </div>
              ))}
            </fieldset>
          ))}

          <div className="grid grid-cols-2 gap-4">
            <Grupo label="Sets ganados (eq. 1 / eq. 2)">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={0}
                  value={form.setsA}
                  onChange={(e) => setForm((f) => ({ ...f, setsA: e.target.valueAsNumber || 0 }))}
                />
                <Input
                  type="number"
                  min={0}
                  value={form.setsB}
                  onChange={(e) => setForm((f) => ({ ...f, setsB: e.target.valueAsNumber || 0 }))}
                />
              </div>
            </Grupo>
            <Grupo label="Juegos del set actual">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={0}
                  value={form.juegosA}
                  onChange={(e) => setForm((f) => ({ ...f, juegosA: e.target.valueAsNumber || 0 }))}
                />
                <Input
                  type="number"
                  min={0}
                  value={form.juegosB}
                  onChange={(e) => setForm((f) => ({ ...f, juegosB: e.target.valueAsNumber || 0 }))}
                />
              </div>
            </Grupo>
          </div>

          <Grupo label="Punto actual (eq. 1 / eq. 2)">
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Punto equipo 1"
                className={selectClass}
                value={String(form.puntoA)}
                onChange={(e) => setForm((f) => ({ ...f, puntoA: parsePunto(e.target.value) }))}
              >
                {PUNTOS.map((p) => (
                  <option key={String(p)} value={String(p)}>
                    {etiquetaPunto(p)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Punto equipo 2"
                className={selectClass}
                value={String(form.puntoB)}
                onChange={(e) => setForm((f) => ({ ...f, puntoB: parsePunto(e.target.value) }))}
              >
                {PUNTOS.map((p) => (
                  <option key={String(p)} value={String(p)}>
                    {etiquetaPunto(p)}
                  </option>
                ))}
              </select>
            </div>
          </Grupo>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar partido'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
