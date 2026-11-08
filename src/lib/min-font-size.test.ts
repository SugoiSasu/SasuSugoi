import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Redesign 2026-11: napisy mają min. 10 px (docelowo 11 px). Poniżej 10 px wolno tylko w okrągłych
 * plakietkach z cyfrą licznika - wyjątki wymienione tu z limitem liczby wystąpień. Nowy mikro-napis
 * poza tą listą wywali test: zamiast go dopisywać, użyj text-[11px] albo większego.
 */
const WYJATKI: Record<string, number> = {
  'components/BottomTabBar.tsx': 1,
  'components/ranking/RankingBoard.tsx': 3, // cyfry w okrągłych plakietkach miejsca
  'routes/_authenticated/profile.tsx': 1,
}

function pliki(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) pliki(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

describe('minimalna wielkość napisów', () => {
  it('poniżej 10 px tylko w znanych plakietkach z licznikami', () => {
    const src = path.resolve(__dirname, '..')
    const naruszenia: string[] = []
    for (const f of pliki(src)) {
      const rel = path.relative(src, f).split(path.sep).join('/')
      const n = (fs.readFileSync(f, 'utf8').match(/text-\[(?:[1-9]|9(?:\.\d+)?)px\]/g) ?? []).length
      if (n > (WYJATKI[rel] ?? 0)) naruszenia.push(`${rel}: ${n} (dozwolone ${WYJATKI[rel] ?? 0})`)
    }
    expect(naruszenia).toEqual([])
  })
})
