import { describe, expect, it } from 'vitest'
import {
  construirTorneo,
  etiquetaCategoria,
  fechaLocal,
  formatearFecha,
  formatearRango,
  nombreGenero,
  nombreNivel,
  validarTorneo,
  type TorneoFormValues,
} from './torneos'

const valido: TorneoFormValues = {
  nombre: 'Open de Otoño',
  fechaInicio: '2026-09-07',
  fechaFin: '2026-09-13',
  inscripcionApertura: '2026-08-01',
  inscripcionCierre: '2026-09-01',
  pistasDisponibles: 3,
}

describe('validarTorneo', () => {
  it('acepta un torneo completo y coherente', () => {
    expect(validarTorneo(valido)).toBeNull()
  })

  it('exige el nombre', () => {
    expect(validarTorneo({ ...valido, nombre: '  ' })).toMatch(/nombre/)
  })

  it('exige las fechas del torneo y su orden', () => {
    expect(validarTorneo({ ...valido, fechaInicio: '' })).toMatch(/inicio y fin/)
    expect(validarTorneo({ ...valido, fechaFin: '2026-09-01' })).toMatch(/anterior/)
  })

  it('permite un torneo de un solo día', () => {
    expect(validarTorneo({ ...valido, fechaFin: valido.fechaInicio })).toBeNull()
  })

  it('exige el plazo de inscripción y su orden', () => {
    expect(validarTorneo({ ...valido, inscripcionCierre: '' })).toMatch(/plazo/)
    expect(validarTorneo({ ...valido, inscripcionCierre: '2026-07-01' })).toMatch(/cierre/i)
  })

  it('exige al menos una pista', () => {
    expect(validarTorneo({ ...valido, pistasDisponibles: 0 })).toMatch(/pista/)
    expect(validarTorneo({ ...valido, pistasDisponibles: Number.NaN })).toMatch(/pista/)
  })
})

describe('construirTorneo', () => {
  it('recorta el nombre y expande el plazo a días completos', () => {
    const cuerpo = construirTorneo({ ...valido, nombre: '  Open  ' })

    expect(cuerpo.nombre).toBe('Open')
    expect(cuerpo.inscripcionApertura).toBe('2026-08-01T00:00:00')
    expect(cuerpo.inscripcionCierre).toBe('2026-09-01T23:59:59')
    expect(cuerpo.fechaInicio).toBe('2026-09-07')
  })
})

describe('fechas', () => {
  it('fechaLocal no retrocede de día por zona horaria', () => {
    const fecha = fechaLocal('2026-09-07')
    expect([fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate()]).toEqual([2026, 9, 7])
  })

  it('fechaLocal acepta fecha-hora ISO', () => {
    expect(fechaLocal('2026-08-01T09:00:00').getDate()).toBe(1)
  })

  it('formatearFecha usa formato corto en español', () => {
    expect(formatearFecha('2026-09-07')).toMatch(/07 sept/)
  })

  it('formatearRango colapsa los torneos de un día', () => {
    expect(formatearRango('2026-09-07', '2026-09-07')).toBe(formatearFecha('2026-09-07'))
    expect(formatearRango('2026-09-07', '2026-09-13')).toContain('–')
  })
})

describe('nombreNivel', () => {
  it('traduce los niveles habituales', () => {
    expect(nombreNivel(1)).toBe('Primera')
    expect(nombreNivel(3)).toBe('Tercera')
  })

  it('no se rompe con niveles fuera de la lista', () => {
    expect(nombreNivel(9)).toBe('Nivel 9')
  })
})

describe('etiquetaCategoria', () => {
  it('compone nivel, letra y género', () => {
    expect(etiquetaCategoria({ nivel: 3, genero: 'masculino', letra: 'B' })).toBe('Tercera B — Masculino')
  })

  it('omite la letra cuando la categoría es única', () => {
    expect(etiquetaCategoria({ nivel: 1, genero: 'mixto', letra: null })).toBe('Primera — Mixto')
  })

  it('capitaliza el género', () => {
    expect(nombreGenero('femenino')).toBe('Femenino')
  })
})
