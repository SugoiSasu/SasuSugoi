import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { brand } from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pl" dir="ltr">
    <Head />
    <Preview>Twój kod weryfikacyjny poŻeramy.</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandBar}>
          po<span style={brand.brandAccent}>Ż</span>eramy
        </Text>
        <Heading style={brand.h1}>Kod weryfikacyjny</Heading>
        <Text style={brand.text}>
          Wpisz poniższy kod, aby potwierdzić swoją tożsamość. Kod jest ważny
          tylko przez kilka minut.
        </Text>
        <Section style={brand.card}>
          <Text style={brand.code}>{token}</Text>
        </Section>
        <Hr style={brand.hr} />
        <Text style={brand.footer}>
          Nie prosiłeś o ten kod? Zignoruj tę wiadomość — nikt nie uzyska
          dostępu bez kodu.
          <br />
          poŻeramy · Poznań
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
