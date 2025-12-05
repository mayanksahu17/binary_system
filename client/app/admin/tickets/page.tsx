'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Ticket {
  id: string;
  raisedBy: {
    userId: string;
    name: string;
    email: string;
  };
  department: string;
  service?: string;
  subject: string;
  description?: string;
  status: string;
  document?: string;
  reply?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTicketsPage() {
  const { admin } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    fetchTickets();
  }, [page, statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await api.getAllTickets({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      if (response.data) {
        setTickets(response.data.tickets || []);
        setTotalPages(response.data.pagination?.pages || 1);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    if (!newStatus && !reply) {
      toast.error('Please provide a status update or reply');
      return;
    }

    setUpdating(true);
    try {
      await api.updateTicket(selectedTicket.id, {
        status: newStatus || undefined,
        reply: reply || undefined,
      });
      toast.success('Ticket updated successfully!');
      setSelectedTicket(null);
      setReply('');
      setNewStatus('');
      await fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-blue-100 text-blue-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'Closed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
          <p className="mt-4 text-gray-600">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and respond to user support tickets</p>
        </div>
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                      {ticket.id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900">{ticket.raisedBy.userId}</div>
                      <div className="text-gray-500">{ticket.raisedBy.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {ticket.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ticket.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ticket.service || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setNewStatus(ticket.status);
                          setReply(ticket.reply || '');
                        }}
                        className="text-indigo-600 hover:text-indigo-900 font-medium"
                      >
                        View/Update
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Update Ticket Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Ticket Details</h3>
                <button
                  onClick={() => {
                    setSelectedTicket(null);
                    setReply('');
                    setNewStatus('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                  <p className="text-sm text-gray-900">{selectedTicket.raisedBy.userId} - {selectedTicket.raisedBy.name}</p>
                  <p className="text-sm text-gray-500">{selectedTicket.raisedBy.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <p className="text-sm text-gray-900">{selectedTicket.subject}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedTicket.description || 'No description provided'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <p className="text-sm text-gray-900">{selectedTicket.department}</p>
                </div>

                {selectedTicket.service && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                    <p className="text-sm text-gray-900">{selectedTicket.service}</p>
                  </div>
                )}

                {selectedTicket.reply && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Previous Reply</label>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-md">{selectedTicket.reply}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="newStatus" className="block text-sm font-medium text-gray-700 mb-2">
                    Update Status
                  </label>
                  <select
                    id="newStatus"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={selectedTicket.status}>{selectedTicket.status}</option>
                    {['Open', 'In Progress', 'Closed'].filter(s => s !== selectedTicket.status).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="reply" className="block text-sm font-medium text-gray-700 mb-2">
                    Reply to User
                  </label>
                  <textarea
                    id="reply"
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Enter your reply to the user..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setSelectedTicket(null);
                      setReply('');
                      setNewStatus('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateTicket}
                    disabled={updating}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? 'Updating...' : 'Update Ticket'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

