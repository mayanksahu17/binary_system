'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
interface Wallet {
  type: string;
  balance: number;
  reserved: number;
  currency: string;
}

interface BinaryTreeInfo {
  cappingLimit: number;
}

interface Withdrawal {
  id: string;
  amount: number;
  charges: number;
  finalAmount: number;
  walletType: string;
  status: string;
  method: string;
  withdrawalId?: string;
  createdAt: string;
}

export default function WithdrawPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [binaryTree, setBinaryTree] = useState<BinaryTreeInfo | null>(null);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedWalletType, setSelectedWalletType] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls (React StrictMode in development)
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    
    fetchData();

    // No cleanup - we want to prevent duplicate calls even on remount
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [walletsRes, binaryTreeRes, userProfileRes, reportsRes] = await Promise.all([
        api.getUserWallets(),
        api.getUserBinaryTree().catch(() => ({ data: null })),
        api.getUserProfile().catch(() => ({ data: null })),
        api.getUserReports().catch(() => ({ data: { withdrawals: [] } })),
      ]);

      if (walletsRes.data) {
        setWallets(walletsRes.data.wallets || []);
        const withdrawableWallets = walletsRes.data.wallets.filter((w: Wallet) =>
          ['roi', 'interest', 'referral', 'binary', 'withdrawal', 'career_level'].includes(
            w.type
          )
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
        setWalletAddress(userProfileRes.data.user.walletAddress);
      }
      if (reportsRes.data?.withdrawals) {
        setWithdrawals(reportsRes.data.withdrawals || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    // Check wallet address first
    if (!walletAddress) {
      const errorMsg = 'Crypto wallet address is required. Please set your wallet address before requesting a withdrawal.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!selectedWalletType) {
      const errorMsg = 'Please select a wallet';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      const errorMsg = 'Please enter a valid amount';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const selectedWallet = wallets.find((w) => w.type === selectedWalletType);
    if (!selectedWallet) {
      const errorMsg = 'Selected wallet not found';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const availableBalance = selectedWallet.balance - selectedWallet.reserved;
    if (amount > availableBalance) {
      const errorMsg = `Insufficient balance. Available: $${availableBalance.toFixed(2)}`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (binaryTree && binaryTree.cappingLimit > 0 && amount > binaryTree.cappingLimit) {
      const errorMsg = `Amount exceeds capping limit of $${binaryTree.cappingLimit.toFixed(2)}`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      setWithdrawing(true);
      setError('');
      const response = await api.createWithdrawal({
        amount,
        walletType: selectedWalletType,
        method: 'crypto',
      });

      if (response.data) {
        toast.success('Withdrawal request submitted successfully!');
        setWithdrawAmount('');
        await fetchData();
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Withdrawal failed';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleUpdatePaymentInfo = async () => {
    if (!walletAddress) {
      const errorMsg = 'Please enter a crypto wallet address';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }
    try {
      setError('');
      await api.updateWalletAddress({ 
        walletAddress: walletAddress
      });
      setShowWalletModal(false);
      toast.success('Payment information updated successfully!');
      await fetchData();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to update payment information';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const selectedWallet = wallets.find((w) => w.type === selectedWalletType);
  const availableBalance = selectedWallet
    ? selectedWallet.balance - selectedWallet.reserved
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
          <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Withdraw Funds</h1>
          </div>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
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
                      .filter((w) =>
                        ['roi', 'interest', 'referral', 'binary', 'withdrawal', 'career_level'].includes(
                          w.type
                        )
                      )
                      .map((wallet) => {
                        const label =
                          wallet.type === 'career_level'
                            ? 'Career Level'
                            : wallet.type === 'referral'
                            ? 'Referral Wallet'
                            : wallet.type === 'binary'
                            ? 'Binary Wallet'
                            : wallet.type === 'roi'
                            ? 'ROI Wallet'
                            : wallet.type === 'withdrawal'
                            ? 'Withdrawal Wallet'
                            : wallet.type === 'interest'
                            ? 'Interest Wallet'
                            : wallet.type;
                        return (
                          <option key={wallet.type} value={wallet.type}>
                            {label} - Available: ${(wallet.balance - wallet.reserved).toFixed(2)}
                          </option>
                        );
                      })}
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
                      disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || !walletAddress}
                      className="w-full px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      {withdrawing ? 'Processing...' : 'Submit Withdrawal Request'}
                    </button>
                    {!walletAddress && (
                      <p className="mt-2 text-sm text-red-600 text-center">
                        Please set your crypto wallet address to proceed
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Wallet Address Section */}
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Payment Information</h2>
                {!userWalletAddress && (
                  <button
                    onClick={() => setShowWalletModal(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  >
                    Setup Payment Info
                  </button>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Crypto Wallet Address</h3>
                {walletAddress ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm font-mono text-gray-800 break-all">{walletAddress}</p>
                    <p className="text-xs text-green-600 mt-1">✓ Wallet address configured</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Wallet address cannot be changed. Contact admin support if you need to update it.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">No wallet address set</p>
                    <p className="text-xs text-yellow-600 mt-1">Required for withdrawals</p>
                    <p className="text-xs text-gray-600 mt-2">
                      Supported: Bitcoin (BTC), USDT (TRC20/ERC20), USDC, Ethereum (ETH), and other cryptocurrencies
                    </p>
                  </div>
                )}
              </div>
              {!walletAddress && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm font-semibold text-red-800 mb-1">⚠️ Payment Information Required</p>
                  <p className="text-xs text-red-700">
                    You need to set a crypto wallet address to request withdrawals.
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Supported cryptocurrencies: Bitcoin, USDT, USDC, Ethereum, and others
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Withdrawal History Section */}
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Withdrawal History</h2>
              {withdrawals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No withdrawal history found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Withdrawal ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charges</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Final Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {withdrawals.map((wd) => (
                        <tr key={wd.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(wd.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                            {wd.withdrawalId || wd.id.substring(0, 8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ${wd.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${wd.charges.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            ${wd.finalAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                            {wd.walletType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              wd.status === 'approved' ? 'bg-green-100 text-green-800' :
                              wd.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {wd.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Wallet Address Modal */}
          {showWalletModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Setup Payment Information</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Set your crypto wallet address to enable withdrawals.
                  </p>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-900 mb-1">Supported Crypto Addresses:</p>
                    <p className="text-xs text-blue-700">
                      You can use addresses from: <strong>Bitcoin (BTC)</strong>, <strong>USDT (TRC20/ERC20)</strong>, <strong>USDC</strong>, <strong>Ethereum (ETH)</strong>, or other supported cryptocurrencies.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Crypto Wallet Address {userWalletAddress && <span className="text-gray-500">(Cannot be changed)</span>}
                    </label>
                    {userWalletAddress ? (
                      <div className="p-3 bg-gray-50 border border-gray-300 rounded-md">
                        <p className="text-sm font-mono text-gray-800 break-all">{userWalletAddress}</p>
                        <p className="mt-1 text-xs text-red-600">
                          ⚠️ Wallet address cannot be changed once set. Contact admin support if you need to update it.
                        </p>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={walletAddress}
                          onChange={(e) => setWalletAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                          placeholder="Enter your Bitcoin, USDT, USDC, Ethereum, or other crypto wallet address"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Enter your cryptocurrency wallet address (Bitcoin, USDT, USDC, Ethereum, etc.) for crypto withdrawals. This can only be set once.
                        </p>
                        <p className="mt-1 text-xs text-gray-600 font-medium">
                          💡 Make sure to use the correct address format for your chosen cryptocurrency (e.g., Bitcoin addresses start with 1, 3, or bc1; USDT TRC20 addresses start with T).
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowWalletModal(false);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdatePaymentInfo}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                    >
                      Save
                    </button>
            </div>
          </div>
        </div>
      </div>
          )}
    </div>
  );
}
