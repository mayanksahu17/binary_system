'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface Voucher {
  id: string;
  voucherId: string;
  amount: number;
  originalAmount: number | null;
  fromWalletType: string | null;
  createdBy: { name: string; userId: string } | null;
  status: string;
  createdOn: string;
  usedAt: string | null;
  expiry: string | null;
  createdAt: string;
}

export default function VouchersPage() {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAmount, setCreateAmount] = useState('');
  const [fromWalletType, setFromWalletType] = useState('');
  const [creating, setCreating] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);

  useEffect(() => {
    fetchVouchers();
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      const response = await api.getUserWallets();
      if (response.data) {
        setWallets(response.data.wallets || []);
      }
    } catch (err: any) {
      console.error('Failed to load wallets:', err);
    }
  };

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await api.getUserVouchers();
      if (response.data) {
        setVouchers(response.data.vouchers || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVoucher = async () => {
    if (!createAmount || parseFloat(createAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setCreating(true);
      setError('');
      const response = await api.createVoucher({
        amount: parseFloat(createAmount),
        fromWalletType: fromWalletType || undefined,
      });

      if (response.data) {
        setShowCreateModal(false);
        setCreateAmount('');
        setFromWalletType('');
        await fetchVouchers();
        await fetchWallets();
        alert('Voucher created successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create voucher');
    } finally {
      setCreating(false);
    }
  };

  const isExpired = (expiry: string | null) => {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
          <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
            <p className="mt-4 text-gray-600">Loading vouchers...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Vouchers</h1>
                <button
                  onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-md hover:bg-slate-800"
                >
                  + Create Voucher
                </button>
          </div>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

      <div>
            {vouchers.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 text-lg mb-4">No vouchers found</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create Your First Voucher
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vouchers.map((voucher) => {
                  const expired = isExpired(voucher.expiry);
                  return (
                    <div key={voucher.id} className="bg-white rounded-lg shadow-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{voucher.voucherId}</h3>
                          <p className="text-sm text-gray-500">
                            Created: {new Date(voucher.createdOn).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            voucher.status === 'active' && !expired
                              ? 'bg-green-100 text-green-800'
                              : voucher.status === 'used'
                              ? 'bg-blue-100 text-blue-800'
                              : expired
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {expired ? 'Expired' : voucher.status}
                        </span>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
                          <span className="font-medium text-gray-700">Amount:</span>
                          <span className="text-2xl font-bold text-indigo-600">
                            ${voucher.amount.toFixed(2)}
                          </span>
                        </div>
                        {voucher.fromWalletType && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">From Wallet:</span>
                            <span className="font-semibold">{voucher.fromWalletType}</span>
                          </div>
                        )}
                        {voucher.expiry && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Expires:</span>
                            <span className={`font-semibold ${expired ? 'text-red-600' : 'text-gray-900'}`}>
                              {new Date(voucher.expiry).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {voucher.usedAt && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Used On:</span>
                            <span className="font-semibold">
                              {new Date(voucher.usedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Create Voucher Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Voucher</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter amount"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Wallet (Optional)
                  </label>
                  <select
                    value={fromWalletType}
                    onChange={(e) => setFromWalletType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Create without wallet (Free voucher)</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.type} value={wallet.type}>
                        {wallet.type} - ${parseFloat(wallet.balance).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateAmount('');
                      setFromWalletType('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateVoucher}
                    disabled={creating}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Voucher'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
