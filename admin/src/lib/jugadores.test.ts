import { describe, expect, it } from 'vitest'
import { parsearTelefonos, resumenPartidos } from './jugadores'

describe('parsearTelefonos', () => {
  it('separa por comas y punto y coma, limpiando espacios', () => {
    expect(parsearTelefonos(' 600111222, 911223344 ;655000111')).toEqual([
      '600111222',
      '911223344',
      '655000111',
    ])
  })

  it('ignora vacíos y duplicados', () => {
    expect(parsearTelefonos('600111222,, 600111222 ,')).toEqual(['600111222'])
  })

  it('con la cadena vacía no hay teléfonos', () => {
    expect(parsearTelefonos('   ')).toEqual([])
  })
})

describe('resumenPartidos', () => {
  it('resume totales y ganados con plurales', () => {
    expect(resumenPartidos(3, 2)).toBe('3 partidos · 2 ganados')
    expect(resumenPartidos(1, 1)).toBe('1 partido · 1 ganado')
  })

  it('sin partidos lo dice claro', () => {
    expect(resumenPartidos(0, 0)).toBe('Sin partidos todavía')
  })
})
