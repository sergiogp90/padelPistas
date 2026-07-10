import { describe, it, expect } from 'vitest'
import { construirPartido, partidoAForm, validarPartido, PARTIDO_INICIAL } from './score'
import type { ApiMatch } from '@/api/types'

const partido: ApiMatch = {
  teams: [
    { players: [{ name: 'Ana', gender: 'female' }, { name: 'Lucía', gender: 'female' }] },
    { players: [{ name: 'Marta', gender: 'female' }, { name: 'Sara', gender: 'female' }] },
  ],
  score: { currentPoint: [30, 'AD'], games: [[6, 4], [3, 5]], sets: [1, 0] },
}

describe('score', () => {
  it('construye el DTO desde el formulario', () => {
    const form = {
      ...PARTIDO_INICIAL,
      jugadores: [
        { name: 'A', gender: 'male' as const },
        { name: 'B', gender: 'male' as const },
        { name: 'C', gender: 'female' as const },
        { name: 'D', gender: 'female' as const },
      ] as const,
      setsA: 1,
      juegosA: 6,
      juegosB: 3,
      puntoA: 40 as const,
      puntoB: 'AD' as const,
    }
    const match = construirPartido({ ...form, jugadores: [...form.jugadores] })
    expect(match.teams[0].players[0].name).toBe('A')
    expect(match.score.sets).toEqual([1, 0])
    expect(match.score.games).toEqual([[6, 3]])
    expect(match.score.currentPoint).toEqual([40, 'AD'])
  })

  it('rellena el formulario tomando el último set como set actual', () => {
    const form = partidoAForm(partido)
    expect(form.setsA).toBe(1)
    expect(form.juegosA).toBe(3) // último set [3,5]
    expect(form.juegosB).toBe(5)
    expect(form.puntoB).toBe('AD')
    expect(form.jugadores[0].name).toBe('Ana')
  })

  it('un partido nulo da el formulario inicial', () => {
    expect(partidoAForm(null)).toEqual(PARTIDO_INICIAL)
  })

  it('valida nombres obligatorios', () => {
    expect(validarPartido(PARTIDO_INICIAL)).not.toBeNull()
    const completo = partidoAForm(partido)
    expect(validarPartido(completo)).toBeNull()
  })

  it('rechaza juegos negativos', () => {
    const completo = { ...partidoAForm(partido), juegosA: -1 }
    expect(validarPartido(completo)).not.toBeNull()
  })
})
