import { describe, it, expect } from 'vitest'
import { TEAM_PALETTE, assignTeamColors } from '../teamColors'

describe('teamColors', () => {
  it('la paleta tiene colores únicos', () => {
    expect(new Set(TEAM_PALETTE).size).toBe(TEAM_PALETTE.length)
  })

  it('la paleta cubre al menos 6 pistas sin repetir (12 colores)', () => {
    expect(TEAM_PALETTE.length).toBeGreaterThanOrEqual(12)
  })

  it('devuelve un par de colores por pista', () => {
    const pairs = assignTeamColors(4)

    expect(pairs).toHaveLength(4)
    for (const pair of pairs) expect(pair).toHaveLength(2)
  })

  it('asigna colores distintos a los dos equipos de una misma pista', () => {
    for (const [a, b] of assignTeamColors(6)) {
      expect(a).not.toBe(b)
    }
  })

  it('no repite ningún color entre pistas distintas', () => {
    const colors = assignTeamColors(6).flat()

    expect(new Set(colors).size).toBe(colors.length)
  })

  it('la primera pista mantiene el par por defecto azul/naranja', () => {
    const [first] = assignTeamColors(1)

    expect(first).toEqual([TEAM_PALETTE[0], TEAM_PALETTE[1]])
  })

  it('toma los colores de la paleta en orden, de dos en dos', () => {
    const pairs = assignTeamColors(3)

    expect(pairs).toEqual([
      [TEAM_PALETTE[0], TEAM_PALETTE[1]],
      [TEAM_PALETTE[2], TEAM_PALETTE[3]],
      [TEAM_PALETTE[4], TEAM_PALETTE[5]],
    ])
  })

  it('acepta una paleta personalizada', () => {
    const pairs = assignTeamColors(2, [0x111111, 0x222222, 0x333333, 0x444444])

    expect(pairs).toEqual([
      [0x111111, 0x222222],
      [0x333333, 0x444444],
    ])
  })

  it('reutiliza la paleta de forma cíclica si no hay colores suficientes', () => {
    // 3 pistas → 6 colores, pero la paleta solo tiene 4: envuelve sin fallar.
    const pairs = assignTeamColors(3, [0xaa, 0xbb, 0xcc, 0xdd])

    expect(pairs).toEqual([
      [0xaa, 0xbb],
      [0xcc, 0xdd],
      [0xaa, 0xbb],
    ])
  })

  it('devuelve una lista vacía para 0 pistas', () => {
    expect(assignTeamColors(0)).toEqual([])
  })
})
