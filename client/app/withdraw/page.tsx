'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Wallet {
  type: string;
  balance: number;
  reserved: number;
  currency: string;
}

interface BinaryTreeInfo {
  cappingLimit: number;
}

export default function WithdrawPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [binaryTree, setBinaryTree] = useState<BinaryTreeInfo | null>(null);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedWalletType, setSelectedWalletType] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('regular');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [walletsRes, binaryTreeRes, userProfileRes] = await Promise.all([
        api.getUserWallets(),
        api.getUserBinaryTree().catch(() => ({ data: null })),
        api.getUserProfile().catch(() => ({ data: null })),
      ]);

      if (walletsRes.data) {
        setWallets(walletsRes.data.wallets || []);
        const withdrawableWallets = walletsRes.data.wallets.filter(
          (w: Wallet) => ['roi', 'interest', 'r&b', 'withdrawal'].includes(w.type)
        );
        if (withdrawableWallets.length > 0 && !selectedWalletType) {
          setSelectedWalletType(withdrawableWallets[0].type);
        }
      }
      if (binaryTreeRes.data) {
        setBinaryTree({
          cappingLimit: binaryTreeRes.data.binaryTree.cappingLimit || 0,
        });
      }
      if (userProfileRes.data?.user?.walletAddress) {
        setUserWalletAddress(userProfileRes.data.user.walletAddress);
      } else if (userProfileRes.data?.user?.bankAccount?.accountNumber) {
        setUserWalletAddress(userProfileRes.data.user.bankAccount.accountNumber);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    // Check wallet address first
    if (!userWalletAddress) {
      setError('Wallet address or bank account is required. Please set your wallet address in the dashboard before requesting a withdrawal.');
      return;
    }

    if (!selectedWalletType) {
      setError('Please select a wallet');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const selectedWallet = wallets.find((w) => w.type === selectedWalletType);
    if (!selectedWallet) {
      setError('Selected wallet not found');
      return;
    }

    const availableBalance = selectedWallet.balance - selectedWallet.reserved;
    if (amount > availableBalance) {
      setError(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`);
      return;
    }

    if (binaryTree && binaryTree.cappingLimit > 0 && amount > binaryTree.cappingLimit) {
      setError(`Amount exceeds capping limit of $${binaryTree.cappingLimit.toFixed(2)}`);
      return;
    }

    try {
      setWithdrawing(true);
      setError('');
      const response = await api.createWithdrawal({
        amount,
        walletType: selectedWalletType,
        method: withdrawMethod,
      });

      if (response.data) {
        alert('Withdrawal request submitted successfully!');
        setWithdrawAmount('');
        await fetchData();
      }
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  const selectedWallet = wallets.find((w) => w.type === selectedWalletType);
  const availableBalance = selectedWallet
    ? selectedWallet.balance - selectedWallet.reserved
    : 0;

  if (loading) {
    return (
      <ProtectedRoute requireUser>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireUser>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  ← Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Withdraw Funds</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">Welcome, {user?.name}</span>
                <button
                  onClick={() => {
                    logout();
                    router.push('/login');
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!userWalletAddress && (
            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="font-semibold mb-1">⚠️ Payment Information Required</p>
              <p className="text-sm mb-2">
                You need to set either a wallet address or bank account details before requesting a withdrawal.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Go to Dashboard to Setup Payment Info
              </button>
            </div>
          )}

          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white rounded-lg shadow p-6">
              {binaryTree && binaryTree.cappingLimit > 0 && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Capping Limit:</strong> ${binaryTree.cappingLimit.toFixed(2)} per withdrawal
                  </p>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Wallet
                  </label>
                  <select
                    value={selectedWalletType}
                    onChange={(e) => setSelectedWalletType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a wallet</option>
                    {wallets
                      .filter((w) => ['roi', 'interest', 'r&b', 'withdrawal'].includes(w.type))
                      .map((wallet) => (
                        <option key={wallet.type} value={wallet.type}>
                          {wallet.type} - Available: ${(wallet.balance - wallet.reserved).toFixed(2)}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedWallet && (
                  <>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Total Balance:</span>
                        <span className="font-semibold">${selectedWallet.balance.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Reserved:</span>
                        <span className="font-semibold">${selectedWallet.reserved.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-medium text-gray-700">Available:</span>
                        <span className="text-lg font-bold text-green-600">
                          ${availableBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Withdrawal Amount (USD)
                      </label>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        min="0.01"
                        max={availableBalance}
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter amount"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Maximum: ${availableBalance.toFixed(2)}
                        {binaryTree && binaryTree.cappingLimit > 0 && (
                          <> | Capping Limit: ${binaryTree.cappingLimit.toFixed(2)}</>
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Withdrawal Method
                      </label>
                      <select
                        value={withdrawMethod}
                        onChange={(e) => setWithdrawMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="regular">Regular</option>
                        <option value="crypto">Crypto</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="card">Card</option>
                      </select>
                    </div>

                    {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Withdrawal Summary</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Amount:</span>
                            <span className="font-semibold">${parseFloat(withdrawAmount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Charges (5%):</span>
                            <span className="font-semibold">
                              -${(parseFloat(withdrawAmount) * 0.05).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-blue-200">
                            <span className="font-medium text-gray-900">Final Amount:</span>
                            <span className="text-lg font-bold text-blue-600">
                              ${(parseFloat(withdrawAmount) * 0.95).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || !userWalletAddress}
                      className="w-full px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      {withdrawing ? 'Processing...' : 'Submit Withdrawal Request'}
                    </button>
                    {!userWalletAddress && (
                      <p className="mt-2 text-sm text-red-600 text-center">
                        Please set your wallet address in the dashboard to proceed
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
