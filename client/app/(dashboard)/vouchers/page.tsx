'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Voucher {
  id: string;
  voucherId: string;
  amount: number;
  investmentValue?: number;
  multiplier?: number;
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
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls (React StrictMode in development)
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    
    fetchVouchers();
    fetchWallets();

    // No cleanup - we want to prevent duplicate calls even on remount
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
      const errorMsg = err.message || 'Failed to load vouchers';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVoucher = async () => {
    if (!createAmount || parseFloat(createAmount) <= 0) {
      const errorMsg = 'Please enter a valid amount';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!fromWalletType) {
      const errorMsg = 'Please select a wallet to create the voucher from';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Check if selected wallet has sufficient balance
    const selectedWallet = wallets.find(w => w.type === fromWalletType);
    if (selectedWallet) {
      const availableBalance = parseFloat(selectedWallet.balance) - parseFloat(selectedWallet.reserved || '0');
      const requestedAmount = parseFloat(createAmount);
      if (requestedAmount > availableBalance) {
        const errorMsg = `Insufficient balance. Available: $${availableBalance.toFixed(2)}`;
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }

    try {
      setCreating(true);
      setError('');
      const response = await api.createVoucher({
        amount: parseFloat(createAmount),
        fromWalletType: fromWalletType,
      });

      if (response.data) {
        setShowCreateModal(false);
        setCreateAmount('');
        setFromWalletType('');
        setError('');
        await fetchVouchers();
        await fetchWallets();
        toast.success('Voucher created successfully!');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to create voucher';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const isExpired = (expiry: string | null) => {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  };

  const getDaysRemaining = (expiry: string | null) => {
    if (!expiry) return null;
    const expiryDate = new Date(expiry);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysSinceCreation = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const diffTime = now.getTime() - createdDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
                  const daysRemaining = getDaysRemaining(voucher.expiry);
                  const daysSinceCreation = getDaysSinceCreation(voucher.createdAt);
                  const investmentValue = voucher.investmentValue || voucher.amount * (voucher.multiplier || 2);
                  
                  return (
                    <div key={voucher.id} className="bg-white rounded-lg shadow-lg p-6 border-2 border-indigo-100 hover:border-indigo-300 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 font-mono text-sm mb-1">{voucher.voucherId}</h3>
                          <p className="text-xs text-gray-500">
                            Created: {new Date(voucher.createdOn || voucher.createdAt).toLocaleString()}
                          </p>
                          {daysSinceCreation !== null && (
                            <p className="text-xs text-gray-400">
                              {daysSinceCreation} day{daysSinceCreation !== 1 ? 's' : ''} ago
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
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
                        <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-gray-700">Purchase Amount:</span>
                            <span className="text-xl font-bold text-indigo-600">
                              ${voucher.amount.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Investment Value:</span>
                            <span className="text-lg font-bold text-green-600">
                              ${investmentValue.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Multiplier: {voucher.multiplier || 2}x
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-2 bg-gray-50 rounded">
                            <div className="text-gray-600 text-xs mb-1">Created At</div>
                            <div className="font-semibold text-gray-900">
                              {new Date(voucher.createdOn || voucher.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(voucher.createdOn || voucher.createdAt).toLocaleTimeString()}
                            </div>
                          </div>

                          {voucher.expiry && (
                            <div className={`p-2 rounded ${expired ? 'bg-red-50' : 'bg-gray-50'}`}>
                              <div className="text-gray-600 text-xs mb-1">Expiry Date</div>
                              <div className={`font-semibold ${expired ? 'text-red-600' : 'text-gray-900'}`}>
                                {new Date(voucher.expiry).toLocaleDateString()}
                              </div>
                              <div className={`text-xs ${expired ? 'text-red-500' : 'text-gray-400'}`}>
                                {new Date(voucher.expiry).toLocaleTimeString()}
                              </div>
                            </div>
                          )}
                        </div>

                        {voucher.expiry && daysRemaining !== null && (
                          <div className={`p-3 rounded-lg ${expired ? 'bg-red-50 border border-red-200' : daysRemaining <= 7 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                            <div className="flex justify-between items-center">
                              <span className={`font-semibold ${expired ? 'text-red-700' : daysRemaining <= 7 ? 'text-yellow-700' : 'text-green-700'}`}>
                                Days Remaining:
                              </span>
                              <span className={`text-lg font-bold ${expired ? 'text-red-600' : daysRemaining <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {expired ? 'Expired' : daysRemaining <= 0 ? '0' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`}
                              </span>
                            </div>
                            {!expired && daysRemaining > 0 && (
                              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${daysRemaining <= 7 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(100, (daysRemaining / 120) * 100)}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        )}

                        {voucher.usedAt && (
                          <div className="p-2 bg-blue-50 rounded border border-blue-200">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Used On:</span>
                              <span className="font-semibold text-blue-700">
                                {new Date(voucher.usedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {voucher.fromWalletType && (
                          <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                            <span className="text-gray-600">Created From:</span>
                            <span className="font-semibold text-gray-900">{voucher.fromWalletType} Wallet</span>
                          </div>
                        )}

                        {voucher.createdBy && (
                          <div className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded">
                            <span className="text-gray-500">Created By:</span>
                            <span className="text-gray-700">{voucher.createdBy.name} ({voucher.createdBy.userId})</span>
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
                    From Wallet (Required)
                  </label>
                  <select
                    value={fromWalletType}
                    onChange={(e) => setFromWalletType(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a wallet</option>
                    {wallets
                      .filter((wallet) => {
                        // Filter out referral_binary (already removed from system)
                        // Filter out investment and token wallets (not suitable for vouchers)
                        // Only show wallets that can be used for vouchers
                        const allowedTypes = ['roi', 'interest', 'referral', 'binary', 'withdrawal', 'career_level'];
                        return allowedTypes.includes(wallet.type);
                      })
                      .map((wallet) => {
                        // Format wallet type name for display
                        const walletNames: { [key: string]: string } = {
                          roi: 'ROI Wallet',
                          interest: 'Interest Wallet',
                          referral: 'Referral Wallet',
                          binary: 'Binary Wallet',
                          withdrawal: 'Withdrawal Wallet',
                          career_level: 'Career Level Wallet',
                        };
                        return (
                          <option key={wallet.type} value={wallet.type}>
                            {walletNames[wallet.type] || wallet.type} - ${parseFloat(wallet.balance).toFixed(2)}
                          </option>
                        );
                      })}
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateAmount('');
                      setFromWalletType('');
                      setError('');
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
