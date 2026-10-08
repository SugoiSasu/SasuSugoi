import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'
import { brand } from './_brand'
import type { TemplateEntry } from './registry'

interface ProfileReminderProps {
  name?: string
  missingAvatar?: boolean
  missingBio?: boolean
}

const ProfileReminderEmail = ({ name, missingAvatar = true, missingBio = true }: ProfileReminderProps) => {
  const brakuje = [missingAvatar ? 'zdjęcia' : null, missingBio ? 'krótkiego opisu o sobie' : null]
    .filter(Boolean)
    .join(' i ')
  return (
    <Html lang="pl" dir="ltr">
      <Head />
      <Preview>Dokończ swój profil w poŻeramy - to zajmie minutę</Preview>
      <Body style={brand.main}>
        <Container style={brand.container}>
          <Text style={brand.brandBar}>
            po<span style={brand.brandAccent}>Ż</span>eramy
          </Text>
          <Heading style={brand.h1}>Cześć{name ? ` ${name}` : ''}, jak Ci się podoba w poŻeramy?</Heading>
          <Text style={brand.text}>
            Zauważyliśmy, że w Twoim profilu brakuje {brakuje}. Uzupełnienie ich zajmuje
            minutę, a dzięki temu znajomi łatwiej Cię znajdą, a Ty odblokujesz odznakę
            „Kompletny profil" i dodatkowe punkty.
          </Text>
          <Button
            href="https://pozeramy.live/profile"
            style={{
              backgroundColor: '#E63946',
              color: '#ffffff',
              borderRadius: '999px',
              padding: '14px 28px',
              fontWeight: 700,
              fontSize: '16px',
              textDecoration: 'none',
            }}
          >
            Uzupełnij profil
          </Button>
          <Text style={{ ...brand.text, marginTop: '24px' }}>
            Nie masz czasu? Zajrzyj po prostu do{' '}
            <Link href="https://pozeramy.live" style={brand.link}>
              pozeramy.live
            </Link>{' '}
            i wybierz coś dobrego do jedzenia w Poznaniu.
          </Text>
          <Hr style={brand.hr} />
          <Text style={brand.footer}>
            Dostajesz tę wiadomość, ponieważ założyłeś konto w poŻeramy. To jedyne takie
            przypomnienie. Jeśli nie chcesz więcej wiadomości, skorzystaj z linku do
            rezygnacji na dole maila.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ProfileReminderEmail,
  subject: 'Dokończ swój profil w poŻeramy',
  displayName: 'Przypomnienie o uzupełnieniu profilu',
  previewData: { name: 'Ania', missingAvatar: true, missingBio: true },
} satisfies TemplateEntry
