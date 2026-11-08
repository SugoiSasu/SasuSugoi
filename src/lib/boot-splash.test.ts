import { describe, expect, it } from 'vitest'
import { BITE_TIMES, BITES, BOOT_SPLASH_SCRIPT } from './boot-splash'

describe('ekran startowy aplikacji', () => {
  it('wygenerowany skrypt jest poprawnym JavaScriptem', () => {
    expect(() => new Function(BOOT_SPLASH_SCRIPT)).not.toThrow()
  })

  it('włącza się tylko w aplikacji (znacznik w User-Agent)', () => {
    expect(BOOT_SPLASH_SCRIPT).toContain('PozeramyApp')
  })

  it('każdy gryz ma swój moment i swoje kółka', () => {
    expect(BITES.length).toBe(BITE_TIMES.length)
    for (let i = 1; i < BITE_TIMES.length; i++) expect(BITE_TIMES[i]).toBeGreaterThan(BITE_TIMES[i - 1])
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
