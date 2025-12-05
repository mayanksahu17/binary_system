'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  walletAddress?: string;
  bankAccount?: any;
  amount: number;
  charges: number;
  finalAmount: number;
  walletType: string;
  status: string;
  method?: string;
  cryptoType?: string;
  withdrawalId?: string;
  createdAt: string;
}

export default function AdminWithdrawals() {
  const { user, admin, loading: authLoading } = useAuth();
  const { confirm } = useConfirm();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 50 });
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Route protection is handled in layout

  useEffect(() => {
    const isAdminUser = user?.userId === 'CROWN-000000';
    const isAdminAccount = !!admin;

    if (isAdminUser || isAdminAccount) {
      fetchWithdrawals();
    }
  }, [page, statusFilter, user, admin]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getAdminWithdrawals({
        page,
        limit: 50,
        status: statusFilter || undefined,
      });
      if (response.data) {
        setWithdrawals(response.data.withdrawals || []);
        setPagination(response.data.pagination || { total: 0, pages: 0, limit: 50 });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch withdrawals');
      console.error('Error fetching withdrawals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (withdrawalId: string) => {
    const confirmed = await confirm({
      title: 'Approve Withdrawal',
      message: 'Are you sure you want to approve this withdrawal? This will deduct the amount from the user\'s wallet.',
      variant: 'info',
      confirmText: 'Yes, Approve',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    try {
      setProcessingId(withdrawalId);
      await api.approveWithdrawal(withdrawalId);
      toast.success('Withdrawal approved successfully!');
      // Reset filter to show all withdrawals including the newly approved one
      setStatusFilter('');
      setPage(1);
      await fetchWithdrawals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve withdrawal');
      console.error('Error approving withdrawal:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (withdrawalId: string) => {
    const confirmed = await confirm({
      title: 'Reject Withdrawal',
      message: 'Are you sure you want to reject this withdrawal? You can provide a reason in the next step.',
      variant: 'warning',
      confirmText: 'Yes, Reject',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    const reason = prompt('Please provide a reason for rejection (optional):');
    
    try {
      setProcessingId(withdrawalId);
      await api.rejectWithdrawal(withdrawalId, reason || undefined);
      toast.success('Withdrawal rejected successfully!');
      // Reset filter to show all withdrawals including the newly rejected one
      setStatusFilter('');
      setPage(1);
      await fetchWithdrawals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject withdrawal');
      console.error('Error rejecting withdrawal:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Withdrawal Management</h1>
        <p className="mt-1 text-sm text-gray-500">Approve or reject withdrawal requests</p>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-4 py-2 rounded-md ${
                statusFilter === '' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-md ${
                statusFilter === 'pending' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 rounded-md ${
                statusFilter === 'approved' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-4 py-2 rounded-md ${
                statusFilter === 'rejected' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-500">Loading withdrawals...</p>
          </div>
        )}

        {!loading && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {withdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        No withdrawals found
                      </td>
                    </tr>
                  ) : (
                    withdrawals.map((wd) => (
                      <tr key={wd.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{wd.userName}</div>
                          <div className="text-sm text-gray-500">{wd.userId}</div>
                          <div className="text-sm text-gray-500">{wd.userEmail}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-600">
                            {wd.withdrawalId || wd.id.substring(0, 8)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{formatCurrency(wd.amount)}</div>
                          <div className="text-xs text-gray-500">Charges: {formatCurrency(wd.charges)}</div>
                          <div className="text-xs text-gray-500">Final: {formatCurrency(wd.finalAmount)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 capitalize">{wd.walletType}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 font-mono max-w-xs truncate">
                            {wd.walletAddress || wd.bankAccount?.accountNumber || '-'}
                          </div>
                          {wd.bankAccount && (
                            <div className="text-xs text-gray-500 mt-1">
                              {wd.bankAccount.bankName} - {wd.bankAccount.accountHolderName}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(wd.status)}`}>
                            {wd.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{formatDate(wd.createdAt)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {wd.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(wd.id)}
                                disabled={processingId === wd.id}
                                className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded-md hover:bg-green-100 disabled:opacity-50"
                              >
                                {processingId === wd.id ? 'Processing...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleReject(wd.id)}
                                disabled={processingId === wd.id}
                                className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-md hover:bg-red-100 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {wd.status !== 'pending' && (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} withdrawals
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

