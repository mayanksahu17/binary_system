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

interface WithdrawalApprovedEmailProps {
  name: string;
  amount: number;
  charges: number;
  finalAmount: number;
  walletType: string;
  withdrawalId: string;
  transactionId: string;
  dashboardLink: string;
}

const WithdrawalApprovedEmail: React.FC<WithdrawalApprovedEmailProps> = ({
  name,
  amount,
  charges,
  finalAmount,
  walletType,
  withdrawalId,
  transactionId,
  dashboardLink,
}) => (
  <Html lang="en" dir="ltr">
    <Head>
      <title>Withdrawal Approved - CNEOX</title>
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
    <Preview>Great news! Your withdrawal request of ${amount.toFixed(2)} has been approved and processed.</Preview>
    <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Roboto, Verdana, sans-serif' }}>
      <Section>
        <Row>
          <Heading as="h2" style={{ color: '#1f2937', marginBottom: '20px' }}>
            Withdrawal Approved, {name}!
          </Heading>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
            Great news! Your withdrawal request has been approved and the funds have been processed.
          </Text>
        </Row>
        <Row>
          <div style={{ backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <Text style={{ color: '#065f46', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', marginTop: '0' }}>
              Withdrawal Details
            </Text>
            <div style={{ color: '#374151', fontSize: '14px', lineHeight: '22px' }}>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Withdrawal ID:</strong> {withdrawalId}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Transaction ID:</strong> {transactionId}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Requested Amount:</strong> ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Processing Charges (5%):</strong> ${charges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Amount Processed:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>${finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Wallet Type:</strong> {walletType.toUpperCase()}
              </Text>
              <Text style={{ margin: '8px 0', color: '#374151' }}>
                <strong>Status:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>Approved & Processed</span>
              </Text>
            </div>
          </div>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '24px' }}>
            The funds have been deducted from your wallet and will be transferred to your registered payment method. Please allow 1-3 business days for the funds to reflect in your account.
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
            View Transaction History
          </Button>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginTop: '24px' }}>
            If you have any questions about this transaction, please contact our support team.
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

export default WithdrawalApprovedEmail;

