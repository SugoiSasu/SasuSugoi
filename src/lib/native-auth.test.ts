import { afterEach, describe, expect, it, vi } from 'vitest'
import { installAppLinkNavigation } from './native-auth'

type Cb = (e: { url: string }) => void

/** Udaje powłokę Capacitor: addListener zwraca sam uchwyt (most natywny) albo obietnicę (@capacitor/core). */
function stubWindow(shape: 'handle' | 'promise' | 'throws') {
  let cb: Cb | undefined
  const remove = vi.fn()
  const assign = vi.fn()
  const addListener = (_ev: string, fn: Cb) => {
    if (shape === 'throws') throw new Error('plugin niedostepny')
    cb = fn
    return shape === 'handle' ? { remove } : Promise.resolve({ remove })
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    Capacitor: { isNativePlatform: () => true, Plugins: { App: { addListener } } },
    location: { origin: 'https://pozeramy.live', assign },
  }
  return { emit: (url: string) => cb?.({ url }), assign, remove }
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('installAppLinkNavigation', () => {
  it.each(['handle', 'promise'] as const)('nie rzuca i nawiguje po linku (addListener -> %s)', async (shape) => {
    const w = stubWindow(shape)
    const off = installAppLinkNavigation()
    w.emit('https://pozeramy.live/k/pitagoras?x=1')
    expect(w.assign).toHaveBeenCalledWith('/k/pitagoras?x=1')
    off()
    await Promise.resolve()
    expect(w.remove).toHaveBeenCalled()
  })

  it('ignoruje obca domene i niedozwolone sciezki', () => {
    const w = stubWindow('handle')
    installAppLinkNavigation()
    w.emit('https://evil.example/k/x')
    w.emit('https://pozeramy.live/admin')
    w.emit('https://pozeramy.live/auth/app-callback?code=1')
    w.emit('to nie jest adres')
    expect(w.assign).not.toHaveBeenCalled()
  })

  it('nie rzuca, gdy plugin jest niedostepny lub go nie ma', () => {
    stubWindow('throws')
    expect(() => installAppLinkNavigation()()).not.toThrow()
    delete (globalThis as unknown as { window?: unknown }).window
    expect(() => installAppLinkNavigation()()).not.toThrow()
  })
})
