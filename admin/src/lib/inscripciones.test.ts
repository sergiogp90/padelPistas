import { describe, expect, it } from 'vitest'
import { ESTADOS, construirJugadorRef, nombreEstado, varianteEstado } from './inscripciones'

describe('estados', () => {
  it('cubre los cuatro estados con etiqueta y variante', () => {
    for (const estado of ESTADOS) {
      expect(nombreEstado(estado)[0]).toBe(estado[0].toUpperCase())
      expect(['default', 'secondary', 'destructive', 'outline']).toContain(varianteEstado(estado))
    }
  })

  it('la rechazada avisa y la aceptada resalta', () => {
    expect(varianteEstado('rechazada')).toBe('destructive')
    expect(varianteEstado('aceptada')).toBe('default')
  })
})

describe('construirJugadorRef', () => {
  it('el jugador seleccionado manda sobre los campos de nuevo', () => {
    const resultado = construirJugadorRef(7, 'Ignorado', '600', 'jugador 1')
    expect(resultado).toEqual({ ref: { id: 7 } })
  })

  it('sin selección crea uno nuevo con nombre y teléfono', () => {
    const resultado = construirJugadorRef(null, '  Ana Torres ', ' 600111222 ', 'jugador 1')
    expect(resultado).toEqual({ ref: { nombre: 'Ana Torres', telefonos: ['600111222'] } })
  })

  it('el teléfono es opcional', () => {
    const resultado = construirJugadorRef(null, 'Ana', '', 'jugador 1')
    expect(resultado).toEqual({ ref: { nombre: 'Ana', telefonos: [] } })
  })

  it('sin selección ni nombre devuelve un error que nombra al jugador', () => {
    const resultado = construirJugadorRef(null, '   ', '', 'jugador 2')
    expect(resultado).toHaveProperty('error')
    expect((resultado as { error: string }).error).toContain('jugador 2')
  })
})
