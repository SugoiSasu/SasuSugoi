import { describe, expect, it } from 'vitest'
import { maCoPokazac, pierwszaWizyta, tekstUdostepnienia, wRoku, type DaneWrapped } from './wrapped'

const dane = (nad: Partial<DaneWrapped> = {}): DaneWrapped => ({
  rok: 2026,
  imie: 'Ania',
  odwiedzone: 12,
  ulubione: 3,
  opinie: 4,
  znajomi: 5,
  odznaki: 6,
  punkty: 320,
  poziom: 3,
  topKuchnie: [{ cuisine: 'Włoska', share: 50 }],
  topDzielnica: 'Jeżyce',
  pierwszyLokal: 'Fika',
  ...nad,
})

describe('wRoku', () => {
  it('zostawia tylko wpisy z danego roku', () => {
    const lista = [{ added_at: '2025-06-30T10:00:00Z' }, { added_at: '2026-03-01T10:00:00Z' }, { added_at: '2026-11-08T10:00:00Z' }, {}]
    expect(wRoku(lista, 2026)).toHaveLength(2)
    expect(wRoku(undefined, 2026)).toEqual([])
  })
})

describe('pierwszaWizyta', () => {
  it('zwraca najstarszą wizytę niezależnie od kolejności listy', () => {
    expect(
      pierwszaWizyta([
        { added_at: '2026-05-01T00:00:00Z', name: 'B' },
        { added_at: '2026-02-01T00:00:00Z', name: 'A' },
      ]),
    ).toBe('A')
    expect(pierwszaWizyta([])).toBeNull()
  })
})

describe('maCoPokazac', () => {
  it('pusty rok nie udaje podsumowania', () => {
    expect(maCoPokazac(dane({ odwiedzone: 0, ulubione: 0, opinie: 0 }))).toBe(false)
    expect(maCoPokazac(dane({ odwiedzone: 0, ulubione: 0, opinie: 1 }))).toBe(true)
  })
})

describe('tekstUdostepnienia', () => {
  it('zawiera rok, liczbę lokali, kuchnię i link', () => {
    const t = tekstUdostepnienia(dane())
    expect(t).toContain('2026')
    expect(t).toContain('12 odwiedzonych lokali')
    expect(t).toContain('Włoska')
    expect(t).toContain('https://pozeramy.live')
  })
  it('bez kuchni nie wstawia pustej frazy', () => {
    expect(tekstUdostepnienia(dane({ topKuchnie: [] }))).not.toContain('najczęściej')
  })
})
