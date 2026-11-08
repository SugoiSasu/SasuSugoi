import { describe, expect, it } from 'vitest'
import { ilu_skonczylo, zwyciezcy, type CzlonekWyjscia, type Wyjscie, type WynikLokalu } from './outing-api'

const w = (place_id: string, yes_count: number, no_count: number, members_total = 3): WynikLokalu => ({
  place_id,
  yes_count,
  no_count,
  members_total,
  ideal: yes_count === members_total && members_total > 1,
})

describe('zwyciezcy wspólnego wyjścia', () => {
  it('wygrywa lokal z największą liczbą „tak”', () => {
    const r = zwyciezcy([w('a', 3, 0), w('b', 2, 1), w('c', 0, 3)])
    expect(r.top.map((x) => x.place_id)).toEqual(['a'])
    expect(r.ideal).toBe(true)
  })

  it('remis pokazuje wszystkie lokale z najwyższym wynikiem, bez „idealnego” matcha', () => {
    const r = zwyciezcy([w('a', 2, 1), w('b', 2, 1), w('c', 1, 2)])
    expect(r.top.map((x) => x.place_id)).toEqual(['a', 'b'])
    expect(r.ideal).toBe(false)
  })

  it('brak jakiegokolwiek „tak” = brak zwycięzcy', () => {
    expect(zwyciezcy([w('a', 0, 3), w('b', 0, 3)])).toEqual({ ideal: false, top: [] })
    expect(zwyciezcy([])).toEqual({ ideal: false, top: [] })
  })
})

describe('ilu_skonczylo', () => {
  const czlonek = (votes_done: number): CzlonekWyjscia => ({
    user_id: String(votes_done),
    display_name: null,
    username: null,
    avatar_url: null,
    is_host: false,
    votes_done,
  })
  it('liczy tylko tych, którzy zagłosowali na wszystkie lokale', () => {
    const wyjscie = {
      place_ids: ['a', 'b', 'c'],
      members: [czlonek(3), czlonek(2), czlonek(3), czlonek(0)],
    } as unknown as Wyjscie
    expect(ilu_skonczylo(wyjscie)).toBe(2)
  })
})
