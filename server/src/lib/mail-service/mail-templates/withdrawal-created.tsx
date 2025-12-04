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

interface WithdrawalCreatedEmailProps {
  name: string;
  amount: number;
  charges: number;
  finalAmount: number;
  walletType: string;
  withdrawalId: string;
  dashboardLink: string;
}

const WithdrawalCreatedEmail: React.FC<WithdrawalCreatedEmailProps> = ({
  name,
  amount,
  charges,
  finalAmount,
  walletType,
  withdrawalId,
  dashboardLink,
}) => (
  <Html lang="en" dir="ltr">
    <Head>
      <title>Withdrawal Request Created - CNEOX</title>
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
    <Preview>Your withdrawal request of ${amount.toFixed(2)} has been submitted and is pending review.</Preview>
    <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Roboto, Verdana, sans-serif' }}>
      <Section>
        <Row>
          <Heading as="h2" style={{ color: '#1f2937', marginBottom: '20px' }}>
            Withdrawal Request Submitted, {name}!
          </Heading>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
            Your withdrawal request has been successfully submitted and is now pending review by our team.
          </Text>
        </Row>
        <Row>
          <div style={{ backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <Text style={{ color: '#92400e', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', marginTop: '0' }}>
              Withdrawal Details
            </Text>
            <div style={{ color: '#374151', fontSize: '14px', lineHeight: '22px' }}>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Withdrawal ID:</strong> {withdrawalId}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Requested Amount:</strong> ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Processing Charges (5%):</strong> ${charges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Final Amount:</strong> ${finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Wallet Type:</strong> {walletType.toUpperCase()}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Status:</strong> <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Pending Review</span>
              </Text>
            </div>
          </div>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '24px' }}>
            Our team will review your withdrawal request and process it within 24-48 hours. You will receive an email notification once your withdrawal has been approved or if any additional information is required.
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
            View Withdrawal Status
          </Button>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginTop: '24px' }}>
            If you have any questions about your withdrawal request, please contact our support team.
          </Text>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginTop: '16px' }}>
            Thank you for using CNEOX!
          </Text>
        </Row>
      </Section>
    </Container>
  </Html>
);

export default WithdrawalCreatedEmail;

