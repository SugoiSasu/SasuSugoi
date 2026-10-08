import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@react-email/render'
import { template } from './profile-reminder'

// React wstawia <!-- --> miedzy fragmenty tekstu; do porownania je usuwamy.
const tekst = (html: string) => html.replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ')

describe('szablon profile-reminder', () => {
  it('wymienia to, czego brakuje, i prowadzi do profilu', async () => {
    const html = await render(React.createElement(template.component, { name: 'Ania', missingAvatar: true, missingBio: true }))
    expect(tekst(html)).toContain('Cześć Ania')
    expect(tekst(html)).toContain('zdjęcia i krótkiego opisu o sobie')
    expect(tekst(html)).toContain('https://pozeramy.live/profile')
  })
  it('mówi tylko o brakującym bio, gdy jest zdjęcie', async () => {
    const html = await render(React.createElement(template.component, { missingAvatar: false, missingBio: true }))
    expect(tekst(html)).toContain('brakuje krótkiego opisu o sobie')
    expect(tekst(html)).not.toContain('brakuje zdjęcia')
  })
})
