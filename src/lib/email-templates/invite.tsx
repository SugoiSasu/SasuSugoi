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
  Section,
  Text,
} from '@react-email/components'
import { brand } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Zaproszenie do {siteName} — dołącz do żarcia.</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandBar}>
          po<span style={brand.brandAccent}>Ż</span>eramy
        </Text>
        <Heading style={brand.h1}>Masz zaproszenie 🎉</Heading>
        <Text style={brand.text}>
          Ktoś chce, żebyś dołączył(a) do{' '}
          <Link href={siteUrl} style={brand.link}>
            <strong>{siteName}</strong>
          </Link>{' '}
          — społeczności, która ocenia knajpy w Poznaniu i nie tylko. Załóż konto
          jednym kliknięciem.
        </Text>
        <Section style={{ textAlign: 'center', margin: '8px 0 28px' }}>
          <Button style={brand.button} href={confirmationUrl}>
            Przyjmij zaproszenie
          </Button>
        </Section>
        <Text style={brand.text}>
          Link awaryjny:
          <br />
          <Link href={confirmationUrl} style={brand.link}>
            {confirmationUrl}
          </Link>
        </Text>
        <Hr style={brand.hr} />
        <Text style={brand.footer}>
          Nie spodziewałeś się tego maila? Po prostu go zignoruj.
          <br />
          poŻeramy · Poznań
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
