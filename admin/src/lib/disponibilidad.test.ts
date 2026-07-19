import { describe, expect, it } from 'vitest'
import {
  HORA_PRIMERA,
  HORA_ULTIMA,
  claveSlot,
  diasDelTorneo,
  etiquetaDia,
  horasDelDia,
  setDesdeSlots,
  slotsDesdeSet,
} from './disponibilidad'

describe('diasDelTorneo', () => {
  it('incluye ambos extremos', () => {
    expect(diasDelTorneo('2026-09-07', '2026-09-13')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ])
  })

  it('cruza el cambio de mes sin saltos', () => {
    expect(diasDelTorneo('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
  })

  it('un torneo de un día tiene un solo día', () => {
    expect(diasDelTorneo('2026-09-07', '2026-09-07')).toEqual(['2026-09-07'])
  })

  it('con fin anterior al inicio no genera días', () => {
    expect(diasDelTorneo('2026-09-13', '2026-09-07')).toEqual([])
  })

  it('acota rejillas disparatadas', () => {
    expect(diasDelTorneo('2026-01-01', '2027-12-31').length).toBeLessThanOrEqual(60)
  })
})

describe('horasDelDia', () => {
  it('va de la primera a la última hora en punto', () => {
    const horas = horasDelDia()
    expect(horas[0]).toBe(HORA_PRIMERA)
    expect(horas.at(-1)).toBe(HORA_ULTIMA)
    expect(horas).toHaveLength(HORA_ULTIMA - HORA_PRIMERA + 1)
  })
})

describe('claves y slots', () => {
  it('el set y los slots hacen ida y vuelta ordenando', () => {
    const claves = new Set([claveSlot('2026-09-08', 19), claveSlot('2026-09-07', 10)])

    const slots = slotsDesdeSet(claves)

    expect(slots).toEqual([
      { fecha: '2026-09-07', hora: 10 },
      { fecha: '2026-09-08', hora: 19 },
    ])
    expect(setDesdeSlots(slots)).toEqual(claves)
  })
})

describe('etiquetaDia', () => {
  it('muestra día de la semana y número', () => {
    expect(etiquetaDia('2026-09-07')).toMatch(/lun.*7/)
  })
})
