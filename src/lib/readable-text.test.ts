import { describe, expect, it } from 'vitest'
import { contrastRatio, readableFill, readableTextClass } from './readable-text'

const CREAM: [number, number, number] = [253, 245, 239]
const NAVY: [number, number, number] = [35, 37, 94]

function rgbOf(fill: string): [number, number, number] {
  const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(fill)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  const h = fill.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

describe('readableFill', () => {
  it('zostawia kolor, gdy tekst już jest czytelny', () => {
    expect(readableFill('#3b4cc7')).toBe('#3b4cc7')
    expect(readableFill('#f0b840')).toBe('#f0b840')
  })
  it('przyciemnia średnie pomarańcze do 4.5:1 z kremem', () => {
    for (const k of ['#e35d2e', '#d4582a', '#e26a3a']) {
      const out = readableFill(k)!
      expect(out).not.toBe(k)
      expect(contrastRatio(CREAM, rgbOf(out))).toBeGreaterThanOrEqual(4.5)
      expect(readableTextClass(out)).toBe('text-cream')
    }
  })
  it('nie wywala się na pustym i dziwnym kolorze', () => {
    expect(readableFill(null)).toBeUndefined()
    expect(readableFill('red')).toBe('red')
  })
  it('granat na jasnym polu nadal działa', () => {
    expect(contrastRatio(NAVY, rgbOf('#f0b840'))).toBeGreaterThanOrEqual(4.5)
  })
})
