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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Twój link logowania do {siteName}.</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandBar}>
          po<span style={brand.brandAccent}>Ż</span>eramy
        </Text>
        <Heading style={brand.h1}>Twój link logowania</Heading>
        <Text style={brand.text}>
          Kliknij przycisk poniżej, aby zalogować się do {siteName}. Link jest
          jednorazowy i wygasa po krótkim czasie.
        </Text>
        <Section style={{ textAlign: 'center', margin: '8px 0 28px' }}>
          <Button style={brand.button} href={confirmationUrl}>
            Zaloguj mnie
          </Button>
        </Section>
        <Text style={brand.text}>
          Nie działa przycisk? Wklej ten adres w przeglądarce:
          <br />
          <Link href={confirmationUrl} style={brand.link}>
            {confirmationUrl}
          </Link>
        </Text>
        <Hr style={brand.hr} />
        <Text style={brand.footer}>
          Nie prosiłeś o link? Możesz zignorować tę wiadomość.
          <br />
          poŻeramy · Poznań
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
