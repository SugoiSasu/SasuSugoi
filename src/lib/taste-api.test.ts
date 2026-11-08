import { describe, expect, it } from 'vitest'
import { czegoBrakuje, MIN_SYGNALOW, poziomZgodnosci } from './taste-api'

describe('poziomZgodnosci', () => {
  it.each([
    [100, 'Bliźniacy smaku'],
    [80, 'Bliźniacy smaku'],
    [79, 'Dobrze się dogadacie'],
    [60, 'Dobrze się dogadacie'],
    [59, 'Różne gusty, ciekawe wypady'],
    [40, 'Różne gusty, ciekawe wypady'],
    [39, 'Gusty na przeciwnych biegunach'],
    [0, 'Gusty na przeciwnych biegunach'],
  ])('%i%% to „%s”', (score, etykieta) => {
    expect(poziomZgodnosci(score).etykieta).toBe(etykieta)
  })
})

describe('czegoBrakuje', () => {
  it('wskazuje stronę, której brakuje sygnałów', () => {
    const z = { score: null, reason: 'za_malo_danych' as const }
    expect(czegoBrakuje({ ...z, signals_me: MIN_SYGNALOW, signals_them: 1 })).toEqual({ ty: false, znajomy: true })
    expect(czegoBrakuje({ ...z, signals_me: 0, signals_them: MIN_SYGNALOW })).toEqual({ ty: true, znajomy: false })
    expect(czegoBrakuje({ ...z, signals_me: 1, signals_them: 2 })).toEqual({ ty: true, znajomy: true })
  })
})
