import React from 'react';

interface TicketStatusUpdateEmailProps {
  name: string;
  ticketId: string;
  subject: string;
  oldStatus: string;
  newStatus: string;
  reply?: string;
}

export default function TicketStatusUpdateEmail({
  name,
  ticketId,
  subject,
  oldStatus,
  newStatus,
  reply,
}: TicketStatusUpdateEmailProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return '#3B82F6';
      case 'In Progress':
        return '#F59E0B';
      case 'Closed':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div style={{ backgroundColor: '#4F46E5', color: 'white', padding: '20px', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Ticket Status Updated</h1>
      </div>
      
      <div style={{ backgroundColor: '#F9FAFB', padding: '30px', borderRadius: '0 0 8px 8px', border: '1px solid #E5E7EB' }}>
        <p style={{ fontSize: '16px', color: '#374151', marginBottom: '20px' }}>
          Hello {name},
        </p>
        
        <p style={{ fontSize: '16px', color: '#374151', marginBottom: '20px' }}>
          Your support ticket status has been updated.
        </p>
        
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Ticket ID:</strong> {ticketId}
          </p>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Subject:</strong> {subject}
          </p>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>Previous Status:</strong> {oldStatus}
          </p>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#6B7280' }}>
            <strong style={{ color: '#374151' }}>New Status:</strong>{' '}
            <span style={{ color: getStatusColor(newStatus), fontWeight: 'bold' }}>{newStatus}</span>
          </p>
        </div>
        
        {reply && (
          <div style={{ backgroundColor: '#EFF6FF', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #BFDBFE' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px', color: '#1E40AF' }}>
              Admin Reply:
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#1E3A8A', whiteSpace: 'pre-wrap' }}>
              {reply}
            </p>
          </div>
        )}
        
        <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '20px' }}>
          You can view your ticket and its status in your dashboard.
        </p>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '20px', color: '#6B7280', fontSize: '12px' }}>
        <p>This is an automated email. Please do not reply to this message.</p>
      </div>
    </div>
  );
}

