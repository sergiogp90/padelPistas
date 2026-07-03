import { describe, it, expect, beforeEach } from 'vitest'
import { installInputGuards } from './inputGuards'

describe('installInputGuards', () => {
  let target: HTMLElement

  beforeEach(() => {
    target = document.createElement('div')
  })

  it('previene el menú contextual', () => {
    installInputGuards(target)
    const event = new Event('contextmenu', { cancelable: true })
    target.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('previene el zoom con Ctrl+rueda pero no el scroll normal', () => {
    installInputGuards(target)

    const withCtrl = new WheelEvent('wheel', { ctrlKey: true, cancelable: true })
    target.dispatchEvent(withCtrl)
    expect(withCtrl.defaultPrevented).toBe(true)

    const withoutCtrl = new WheelEvent('wheel', { ctrlKey: false, cancelable: true })
    target.dispatchEvent(withoutCtrl)
    expect(withoutCtrl.defaultPrevented).toBe(false)
  })

  it('stop() retira los guardas', () => {
    const { stop } = installInputGuards(target)
    stop()

    const event = new Event('contextmenu', { cancelable: true })
    target.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})
