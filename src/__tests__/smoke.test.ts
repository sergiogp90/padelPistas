import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('ejecuta la tubería de tests correctamente', () => {
    expect(1 + 1).toBe(2)
  })

  it('tiene disponible el entorno jsdom', () => {
    const el = document.createElement('div')
    el.textContent = 'padel'
    expect(el.textContent).toBe('padel')
  })
})
