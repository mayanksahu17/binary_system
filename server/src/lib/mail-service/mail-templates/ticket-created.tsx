import React from 'react';

interface TicketCreatedEmailProps {
  name: string;
  ticketId: string;
  subject: string;
  department: string;
}

export default function TicketCreatedEmail({
  name,
  ticketId,
  subject,
  department,
}: TicketCreatedEmailProps) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div style={{ backgroundColor: '#4F46E5', color: 'white', padding: '20px', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Ticket Created Successfully</h1>
      </div>
      
      <div style={{ backgroundColor: '#F9FAFB', padding: '30px', borderRadius: '0 0 8px 8px', border: '1px solid #E5E7EB' }}>
        <p style={{ fontSize: '16px', color: '#374151', marginBottom: '20px' }}>
          Hello {name},
        </p>
        
        <p style={{ fontSize: '16px', color: '#374151', marginBottom: '20px' }}>
          Your support ticket has been created successfully. Our team will review it and get back to you soon.
        </p>
        
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Ticket ID:</strong> {ticketId}
          </p>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Subject:</strong> {subject}
          </p>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Department:</strong> {department}
          </p>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Status:</strong> <span style={{ color: '#10B981', fontWeight: 'bold' }}>Open</span>
          </p>
        </div>
        
        <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '20px' }}>
          You will receive an email notification when your ticket status is updated.
        </p>
        
        <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '20px' }}>
          If you have any urgent concerns, please contact our support team directly.
        </p>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '20px', color: '#6B7280', fontSize: '12px' }}>
        <p>This is an automated email. Please do not reply to this message.</p>
      </div>
    </div>
  );
}

