import { afterEach, describe, expect, it, vi } from 'vitest'
import { BITE_TIMES, BITES, GULP_AT } from './boot-splash-art'
import { BOOT_SPLASH_SCRIPT, RESUME_AFTER_MS, installResumeBootSplash } from './boot-splash'

/** Uruchamia wygenerowany skrypt na atrapach przeglądarki; zwraca, ile razy dołożył ekran startowy do strony. */
function uruchom(userAgent: string, store: Record<string, string>) {
  let dolozono = 0
  const el = (): Record<string, unknown> => ({
    style: {},
    classList: { add() {} },
    setAttribute() {},
    appendChild() {},
    querySelector: () => el(),
    remove() {},
  })
  const doc = {
    createElement: () => el(),
    head: { appendChild() {} },
    documentElement: { appendChild: () => void dolozono++ },
  }
  const sessionStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  }
  class FakeImage {
    style: Record<string, unknown> = {}
    set src(_v: string) {}
  }
  const win: Record<string, unknown> = {}
  new Function('navigator', 'sessionStorage', 'document', 'window', 'matchMedia', 'Image', 'setTimeout', BOOT_SPLASH_SCRIPT)(
    { userAgent },
    sessionStorage,
    doc,
    win,
    () => ({ matches: false }),
    FakeImage,
    () => 0,
  )
  return dolozono
}

const APP = 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36 PozeramyApp/1.0'
const PRZEGLADARKA = 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36'

describe('ekran startowy aplikacji', () => {
  it('wygenerowany skrypt jest poprawnym JavaScriptem', () => {
    expect(() => new Function(BOOT_SPLASH_SCRIPT)).not.toThrow()
  })

  it('pokazuje się w aplikacji, ale nie w zwykłej przeglądarce', () => {
    expect(uruchom(APP, {})).toBe(1)
    expect(uruchom(PRZEGLADARKA, {})).toBe(0)
  })

  it('gra raz na uruchomienie aplikacji: kolejne przeładowania go nie powtarzają', () => {
    const store: Record<string, string> = {}
    expect(uruchom(APP, store)).toBe(1)
    expect(uruchom(APP, store)).toBe(0)
    expect(uruchom(APP, store)).toBe(0)
  })

  it('każdy gryz ma swój moment i swoje kółka, a gulp jest po ostatnim gryzie', () => {
    expect(BITES.length).toBe(BITE_TIMES.length)
    for (let i = 1; i < BITE_TIMES.length; i++) expect(BITE_TIMES[i]).toBeGreaterThan(BITE_TIMES[i - 1])
    expect(GULP_AT).toBeGreaterThan(BITE_TIMES[BITE_TIMES.length - 1])
  })

  it('gryzy razem zjadają cały kafelek (zaokrąglony kwadrat 104, rx 26)', () => {
    const kola = BITES.flat()
    const niepokryte: Array<[number, number]> = []
    for (let x = 0; x <= 104; x++) {
      for (let y = 0; y <= 104; y++) {
        const cx = Math.min(Math.max(x, 26), 78)
        const cy = Math.min(Math.max(y, 26), 78)
        if (Math.hypot(x - cx, y - cy) > 26) continue // poza kafelkiem
        if (!kola.some(([a, b, r]) => Math.hypot(x - a, y - b) <= r)) niepokryte.push([x, y])
      }
    }
    expect(niepokryte).toEqual([])
  })
})

describe('ponowne pokazanie ekranu po powrocie do aplikacji', () => {
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  function przygotuj() {
    const show = vi.fn()
    ;(globalThis as unknown as { window: unknown }).window = { __pzBootShow: show }
    let cb: ((e: { isActive: boolean }) => void) | undefined
    let teraz = 1_000_000
    installResumeBootSplash(
      (_ev, fn) => {
        cb = fn
        return () => {}
      },
      () => teraz,
    )
    return { show, ruch: (isActive: boolean, po = 0) => { teraz += po; cb?.({ isActive }) } }
  }

  it('krótka nieobecność nie odpala animacji', () => {
    const t = przygotuj()
    t.ruch(false)
    t.ruch(true, RESUME_AFTER_MS - 1)
    expect(t.show).not.toHaveBeenCalled()
  })

  it('dłuższa nieobecność odpala animację raz, a kolejny powrót liczy czas od nowa', () => {
    const t = przygotuj()
    t.ruch(false)
    t.ruch(true, RESUME_AFTER_MS)
    expect(t.show).toHaveBeenCalledTimes(1)
    t.ruch(true, RESUME_AFTER_MS * 2) // aktywna bez wcześniejszego wyjścia w tło: nic
    expect(t.show).toHaveBeenCalledTimes(1)
  })
})
