import { describe, expect, it } from 'vitest'
import { OCENY_SZYBKIE } from './JakByloSheet'

describe('szybka ocena "Jak było?"', () => {
  it('trzy stopnie mapują się na dozwolone gwiazdki 1-5, rosnąco i bez powtórzeń', () => {
    expect(OCENY_SZYBKIE.map((o) => o.etykieta)).toEqual(['Super', 'Ok', 'Nie'])
    const g = OCENY_SZYBKIE.map((o) => o.gwiazdki)
    expect(g).toEqual([5, 3, 2])
    for (const x of g) {
      expect(Number.isInteger(x)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(1)
      expect(x).toBeLessThanOrEqual(5)
    }
    expect(new Set(g).size).toBe(g.length)
  })
})
