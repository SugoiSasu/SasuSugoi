import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OKAZJE, maOkazje } from './occasions'

describe('oznaczenia okazji', () => {
  it('lista w kodzie zgadza się z ograniczeniem w migracji bazy', () => {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20261109120000_oznaczenia_okazji.sql'),
      'utf8',
    )
    const m = /occasions <@ ARRAY\[([^\]]+)\]/.exec(sql)
    expect(m).not.toBeNull()
    const wBazie = m![1].split(',').map((s) => s.trim().replace(/'/g, ''))
    expect([...OKAZJE.map((o) => o.key)].sort()).toEqual([...wBazie].sort())
  })

  it('maOkazje toleruje brak danych', () => {
    expect(maOkazje({ occasions: ['randka'] }, 'randka')).toBe(true)
    expect(maOkazje({ occasions: ['randka'] }, 'szybko')).toBe(false)
    expect(maOkazje({ occasions: null }, 'ekipa')).toBe(false)
    expect(maOkazje({}, 'ekipa')).toBe(false)
  })
})
