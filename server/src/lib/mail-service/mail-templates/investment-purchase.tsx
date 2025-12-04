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

interface InvestmentPurchaseEmailProps {
  name: string;
  packageName: string;
  investmentAmount: number;
  duration: number;
  totalOutputPct: number;
  startDate: string;
  endDate: string;
  dashboardLink: string;
}

const InvestmentPurchaseEmail: React.FC<InvestmentPurchaseEmailProps> = ({
  name,
  packageName,
  investmentAmount,
  duration,
  totalOutputPct,
  startDate,
  endDate,
  dashboardLink,
}) => (
  <Html lang="en" dir="ltr">
    <Head>
      <title>Investment Purchase Confirmation - CNEOX</title>
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
    <Preview>Your investment in {packageName} has been confirmed successfully!</Preview>
    <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Roboto, Verdana, sans-serif' }}>
      <Section>
        <Row>
          <Heading as="h2" style={{ color: '#1f2937', marginBottom: '20px' }}>
            Investment Confirmed, {name}!
          </Heading>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
            Congratulations! Your investment has been successfully processed.
          </Text>
        </Row>
        <Row>
          <div style={{ backgroundColor: '#f0f9ff', border: '2px solid #3b82f6', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <Text style={{ color: '#1e40af', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', marginTop: '0' }}>
              Investment Details
            </Text>
            <div style={{ color: '#374151', fontSize: '14px', lineHeight: '22px' }}>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Package:</strong> {packageName}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Investment Amount:</strong> ${investmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Duration:</strong> {duration} days
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Total Output:</strong> {totalOutputPct}%
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Start Date:</strong> {startDate}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>End Date:</strong> {endDate}
              </Text>
            </div>
          </div>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '24px' }}>
            Your investment is now active and will start earning returns. You can track your investment progress in your dashboard.
          </Text>
        </Row>
        <Row style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Button
            href={dashboardLink}
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
            View Investment Dashboard
          </Button>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginBottom: '8px' }}>
            Or copy and paste this link into your browser:
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#4f46e5', fontSize: '14px', lineHeight: '20px', wordBreak: 'break-all', marginBottom: '24px' }}>
            {dashboardLink}
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginTop: '24px' }}>
            If you have any questions about your investment, please contact our support team.
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginTop: '16px' }}>
            Thank you for investing with CNEOX!
          </Text>
        </Row>
      </Section>
    </Container>
  </Html>
);

export default InvestmentPurchaseEmail;

