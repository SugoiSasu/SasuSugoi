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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Zresetuj hasło do {siteName}.</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandBar}>
          po<span style={brand.brandAccent}>Ż</span>eramy
        </Text>
        <Heading style={brand.h1}>Resetowanie hasła</Heading>
        <Text style={brand.text}>
          Dostaliśmy prośbę o reset hasła do Twojego konta w {siteName}. Kliknij
          przycisk poniżej, aby ustawić nowe hasło. Link wygasa w ciągu godziny.
        </Text>
        <Section style={{ textAlign: 'center', margin: '8px 0 28px' }}>
          <Button style={brand.button} href={confirmationUrl}>
            Ustaw nowe hasło
          </Button>
        </Section>
        <Text style={brand.text}>
          Jeśli przycisk nie działa, użyj tego adresu:
          <br />
          <Link href={confirmationUrl} style={brand.link}>
            {confirmationUrl}
          </Link>
        </Text>
        <Hr style={brand.hr} />
        <Text style={brand.footer}>
          Nie prosiłeś o reset? Zignoruj tę wiadomość - Twoje hasło pozostanie
          bez zmian.
          <br />
          poŻeramy · Poznań
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
