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

interface WithdrawalRejectedEmailProps {
  name: string;
  amount: number;
  charges: number;
  finalAmount: number;
  walletType: string;
  withdrawalId: string;
  reason?: string;
  dashboardLink: string;
}

const WithdrawalRejectedEmail: React.FC<WithdrawalRejectedEmailProps> = ({
  name,
  amount,
  charges,
  finalAmount,
  walletType,
  withdrawalId,
  reason,
  dashboardLink,
}) => (
  <Html lang="en" dir="ltr">
    <Head>
      <title>Withdrawal Request Rejected - CNEOX</title>
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
    <Preview>Your withdrawal request of ${amount.toFixed(2)} has been rejected. The reserved funds have been released back to your wallet.</Preview>
    <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Roboto, Verdana, sans-serif' }}>
      <Section>
        <Row>
          <Heading as="h2" style={{ color: '#1f2937', marginBottom: '20px' }}>
            Withdrawal Request Rejected, {name}
          </Heading>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
            We regret to inform you that your withdrawal request has been rejected. The reserved funds have been released back to your wallet and are available for use.
          </Text>
        </Row>
        <Row>
          <div style={{ backgroundColor: '#fee2e2', border: '2px solid #ef4444', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <Text style={{ color: '#991b1b', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', marginTop: '0' }}>
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
                <strong>Status:</strong> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Rejected</span>
              </Text>
              {reason && (
                <Text style={{ margin: '8px 0', color: '#374151', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #fca5a5' }}>
                  <strong>Reason:</strong> {reason}
                </Text>
              )}
            </div>
          </div>
        </Row>
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
            The reserved amount of <strong>${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> has been released back to your {walletType.toUpperCase()} wallet and is now available for use.
          </Text>
        </Row>
        {reason && (
          <Row>
            <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
              <strong>Reason for rejection:</strong> {reason}
            </Text>
          </Row>
        )}
        <Row>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '24px' }}>
            If you believe this is an error or have any questions, please contact our support team. You can submit a new withdrawal request once any issues have been resolved.
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
            View Wallet Balance
          </Button>
        </Row>
        <Row>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px', marginTop: '24px' }}>
            If you need assistance or have questions, please contact our support team.
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

export default WithdrawalRejectedEmail;

