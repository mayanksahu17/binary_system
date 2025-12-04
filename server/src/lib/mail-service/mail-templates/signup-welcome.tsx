import React from 'react';
import {
  Html,
  Head,
  Font,
  Preview,
  Heading,
  Row,
  Section,
  Text,
  Button,
  Container,
} from '@react-email/components';

interface SignupWelcomeEmailProps {
  name: string;
  userId: string;
  loginLink: string;
}

const SignupWelcomeEmail: React.FC<SignupWelcomeEmailProps> = ({
  name,
  userId,
  loginLink,
}) => (
  <Html lang="en" dir="ltr">
    <Head>
      <title>Welcome to CNEOX</title>
      <Font
        fontFamily="Roboto"
        fallbackFontFamily="Verdana"
        webFont={{
          url: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
          format: 'woff2',
        }}
        fontWeight={400}
        fontStyle="normal"
      />
    </Head>
    <Preview>Welcome to CNEOX! Your account has been successfully created.</Preview>
    <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Roboto, Verdana, sans-serif' }}>
      <Section>
        <Row>
          <Heading as="h2" style={{ color: '#1f2937', marginBottom: '20px' }}>
            Welcome to CNEOX, {name}!
          </Heading>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
            Congratulations! Your account has been successfully created.
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
            Your User ID: <strong>{userId}</strong>
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '24px' }}>
            Click the button below to login to your account and access your dashboard:
          </Text>
        </Row>
        <Row style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Button
            href={loginLink}
            style={{
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '6px',
              textDecoration: 'none',
              display: 'inline-block',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Login to Dashboard
          </Button>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginBottom: '8px' }}>
            Or copy and paste this link into your browser:
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#4f46e5', fontSize: '14px', lineHeight: '20px', wordBreak: 'break-all', marginBottom: '24px' }}>
            {loginLink}
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginTop: '24px' }}>
            If you didn't create this account, please ignore this email or contact support.
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginTop: '16px' }}>
            This login link will expire in 24 hours for security purposes.
          </Text>
        </Row>
      </Section>
    </Container>
  </Html>
);

export default SignupWelcomeEmail;

