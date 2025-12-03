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
} from '@react-email/components';

interface StaffAssignmentEmailProps {
  name: string;
  role: string;
  hotelName: string;
  email: string;
  password: string;
}

const StaffAssignmentEmail: React.FC<StaffAssignmentEmailProps> = ({
  name,
  role,
  hotelName,
  email,
  password,
}) => (
  <Html lang="en" dir="ltr">
    <Head>
      <title>Welcome to {hotelName}</title>
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
    <Preview>Welcome aboard! You've been assigned a role at {hotelName}</Preview>
    <Section>
      <Row>
        <Heading as="h2">Hello {name},</Heading>
      </Row>
      <Row>
        <Text>
          Congratulations! You've been assigned the role of <strong>{role}</strong> at <strong>{hotelName}</strong>.
        </Text>
      </Row>
      <Row>
        <Text>
          Here are your login credentials:
        </Text>
      </Row>
      <Row>
        <Text><strong>Email:</strong> {email}</Text>
      </Row>
      <Row>
        <Text><strong>Password:</strong> {password}</Text>
      </Row>
      <Row>
        <Text>
          Please make sure to change your password after logging in for the first time.
        </Text>
      </Row>
      <Row>
        <Text>
          We're excited to have you on board! If you have any questions, feel free to reach out to HR or your manager.
        </Text>
      </Row>
    </Section>
  </Html>
);

export default StaffAssignmentEmail;
