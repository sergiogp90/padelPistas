import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('ejecuta la tubería de tests correctamente', () => {
    expect(1 + 1).toBe(2)
  })

  it('tiene jsdom disponible como entorno por defecto', () => {
    const el = document.createElement('div')
    el.textContent = 'padel'
    expect(el.textContent).toBe('padel')
    expect(typeof window).toBe('object')
  })
})
