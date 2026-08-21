import * as React from 'react'
import {
  Body,
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

interface CollabConfirmationProps {
  brandName?: string
  message?: string
}

const CollabConfirmationEmail = ({
  brandName,
  message,
}: CollabConfirmationProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Dzięki za zgłoszenie współpracy z poŻeramy!</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandBar}>
          po<span style={brand.brandAccent}>Ż</span>eramy
        </Text>
        <Heading style={brand.h1}>Dostaliśmy Twoje zgłoszenie! 🎉</Heading>
        <Text style={brand.text}>
          Cześć{brandName ? ` ${brandName}` : ''}, dzięki za wiadomość dotyczącą
          współpracy z poŻeramy. Zgłoszenie trafiło do naszego panelu - odpowiadamy
          zwykle w ciągu 48 godzin (dni robocze).
        </Text>
        {message ? (
          <>
            <Text style={{ ...brand.text, marginBottom: '8px', fontWeight: 700 }}>
              Twoja wiadomość:
            </Text>
            <div style={brand.card}>
              <Text style={{ ...brand.text, margin: 0, textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                {message}
              </Text>
            </div>
          </>
        ) : null}
        <Text style={brand.text}>
          W międzyczasie możesz zerknąć na naszą stronę i sprawdzić, co u nas słychać:{' '}
          <Link href="https://pozeramy.live" style={brand.link}>pozeramy.live</Link>.
        </Text>
        <Hr style={brand.hr} />
        <Text style={brand.footer}>
          Otrzymujesz tę wiadomość, ponieważ wysłano zgłoszenie współpracy z Twoim
          adresem e-mail w formularzu na pozeramy.live. Jeśli to nie Ty - po prostu
          zignoruj tę wiadomość.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CollabConfirmationEmail,
  subject: 'Dostaliśmy Twoje zgłoszenie współpracy - poŻeramy',
  displayName: 'Potwierdzenie zgłoszenia współpracy',
  previewData: {
    brandName: 'Pizza Forte',
    message: 'Chcielibyśmy nawiązać współpracę przy nowym menu.',
  },
} satisfies TemplateEntry
