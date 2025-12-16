'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Investment {
  id: string;
  package: {
    id: string;
    name: string;
    roi: number;
    duration: number;
  } | null;
  investedAmount: number;
  depositAmount: number;
  type: string;
  isBinaryUpdated: boolean;
  createdAt: string;
  expiresOn?: string;
  voucherId?: string | null;
  voucher?: {
    voucherId: string;
    amount: number;
  } | null;
}

export default function InvestmentsPage() {
  const router = useRouter();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls (React StrictMode in development)
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    
    fetchInvestments();

    // No cleanup - we want to prevent duplicate calls even on remount
  }, []);

  const fetchInvestments = async () => {
    try {
      setLoading(true);
      const response = await api.getUserInvestments();
      if (response.data) {
        setInvestments(response.data.investments);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to load investments';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysRemaining = (expiresOn?: string) => {
    if (!expiresOn) return null;
    const expiry = new Date(expiresOn);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
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

  const handleViewDetails = (investment: Investment) => {
    setSelectedInvestment(investment);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedInvestment(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
          <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
            <p className="mt-4 text-gray-600">Loading investments...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Investments</h1>
        <p className="mt-1 text-sm text-gray-500">View and manage your investment portfolio</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

            {investments.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 text-lg mb-4">No investments yet</p>
                <button
                  onClick={() => router.push('/plans')}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Browse Plans
                </button>
              </div>
            ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Package
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invested Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ROI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {investments.map((inv) => {
                  const daysRemaining = calculateDaysRemaining(inv.expiresOn);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                            {inv.package?.name || 'Unknown Package'}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">{inv.type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-indigo-600">
                          {formatCurrency(inv.investedAmount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {inv.package?.roi || '-'}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {inv.package?.duration || '-'} days
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          daysRemaining !== null && daysRemaining < 7 
                            ? 'text-red-600' 
                            : daysRemaining !== null 
                            ? 'text-green-600' 
                            : 'text-gray-500'
                        }`}>
                          {daysRemaining !== null ? `${daysRemaining} days` : 'Expired'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            inv.isBinaryUpdated
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {inv.isBinaryUpdated ? 'Active' : 'Processing'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(inv.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(inv)}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Investment Details Modal */}
      {showModal && selectedInvestment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  Investment Details
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Package Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Package Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Package Name</p>
                      <p className="text-base font-medium text-gray-900">
                        {selectedInvestment.package?.name || 'Unknown Package'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Investment Type</p>
                      <p className="text-base font-medium text-gray-900 capitalize">
                        {selectedInvestment.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">ROI Percentage</p>
                      <p className="text-base font-medium text-gray-900">
                        {selectedInvestment.package?.roi || '-'}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Duration</p>
                      <p className="text-base font-medium text-gray-900">
                        {selectedInvestment.package?.duration || '-'} days
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Financial Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Invested Amount</p>
                      <p className="text-xl font-bold text-indigo-600">
                        {formatCurrency(selectedInvestment.investedAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Deposit Amount</p>
                      <p className="text-xl font-bold text-indigo-600">
                        {formatCurrency(selectedInvestment.depositAmount)}
                      </p>
                    </div>
                  </div>
                  {/* Voucher Information */}
                  {selectedInvestment.voucher && (
                    <div className="mt-4 pt-4 border-t border-indigo-200">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-semibold text-gray-700">Activated Using Voucher</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-green-200">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-gray-600">Voucher ID:</span>
                          <span className="text-sm font-mono font-semibold text-gray-900">
                            {selectedInvestment.voucher.voucherId}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Voucher Amount:</span>
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(selectedInvestment.voucher.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status & Timeline */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Status & Timeline</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Status</span>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          selectedInvestment.isBinaryUpdated
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {selectedInvestment.isBinaryUpdated ? 'Active' : 'Processing'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Created Date</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(selectedInvestment.createdAt)}
                      </span>
                    </div>
                    {selectedInvestment.expiresOn && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Expiry Date</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(selectedInvestment.expiresOn)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Days Remaining</span>
                          <span className={`text-sm font-semibold ${
                            calculateDaysRemaining(selectedInvestment.expiresOn) !== null && 
                            calculateDaysRemaining(selectedInvestment.expiresOn)! < 7 
                              ? 'text-red-600' 
                              : 'text-green-600'
                          }`}>
                            {calculateDaysRemaining(selectedInvestment.expiresOn) !== null 
                              ? `${calculateDaysRemaining(selectedInvestment.expiresOn)} days` 
                              : 'Expired'}
                          </span>
                            </div>
                          </>
                        )}
                  </div>
                          </div>

                {/* Investment ID */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Investment ID</p>
                  <p className="text-sm font-mono text-gray-900 break-all">
                    {selectedInvestment.id}
                  </p>
                      </div>
                    </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}

