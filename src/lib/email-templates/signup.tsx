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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Aktywuj swoje konto w {siteName} — kliknij w link.</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandBar}>
          po<span style={brand.brandAccent}>Ż</span>eramy
        </Text>
        <Heading style={brand.h1}>Witaj poŻeraczu! 🍕</Heading>
        <Text style={brand.text}>
          Dzięki, że dołączasz do{' '}
          <Link href={siteUrl} style={brand.link}>
            <strong>{siteName}</strong>
          </Link>
          . Zostało już tylko jedno kliknięcie — potwierdź, że ten adres ({recipient})
          należy do Ciebie i ruszamy.
        </Text>
        <Section style={{ textAlign: 'center', margin: '8px 0 28px' }}>
          <Button style={brand.button} href={confirmationUrl}>
            Aktywuj konto
          </Button>
        </Section>
        <Text style={brand.text}>
          Link działa przez 24 godziny. Jeśli przycisk nie działa, wklej ten adres
          w przeglądarce:
          <br />
          <Link href={confirmationUrl} style={brand.link}>
            {confirmationUrl}
          </Link>
        </Text>
        <Hr style={brand.hr} />
        <Text style={brand.footer}>
          Tego maila nie zamawiałeś? Po prostu go zignoruj — nie utworzymy
          konta bez potwierdzenia.
          <br />
          poŻeramy · Poznań
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
