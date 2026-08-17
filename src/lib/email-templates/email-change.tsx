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

interface EmailChangeEmailProps {
  siteName: string
  // For the NEW-recipient half of a secure email_change fanout, `email` equals
  // the recipient (NEW), so render oldEmail to read "from OLD to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Potwierdź zmianę adresu email w {siteName}.</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandBar}>
          po<span style={brand.brandAccent}>Ż</span>eramy
        </Text>
        <Heading style={brand.h1}>Potwierdź zmianę adresu</Heading>
        <Text style={brand.text}>
          W Twoim koncie w {siteName} zlecono zmianę adresu z{' '}
          <Link href={`mailto:${oldEmail}`} style={brand.link}>
            {oldEmail}
          </Link>{' '}
          na{' '}
          <Link href={`mailto:${newEmail}`} style={brand.link}>
            {newEmail}
          </Link>
          . Kliknij przycisk poniżej, aby potwierdzić.
        </Text>
        <Section style={{ textAlign: 'center', margin: '8px 0 28px' }}>
          <Button style={brand.button} href={confirmationUrl}>
            Potwierdź zmianę
          </Button>
        </Section>
        <Hr style={brand.hr} />
        <Text style={brand.footer}>
          Nie Ty zleciłeś zmianę? Natychmiast zaloguj się i zmień hasło, a w
          razie potrzeby napisz do nas.
          <br />
          poŻeramy · Poznań
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
