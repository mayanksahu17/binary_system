'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface Wallet {
  type: string;
  balance: number;
  reserved: number;
  currency: string;
}

const WALLET_TYPE_LABELS: Record<string, string> = {
  withdrawal: 'Withdrawal Wallet',
  roi: 'ROI Wallet',
  referral_binary: 'Referral & Binary Wallet',
  interest: 'Interest Wallet',
  referral: 'Referral Wallet',
  binary: 'Binary Wallet',
  token: 'Token Wallet',
  investment: 'Investment Wallet',
  career_level: 'Career Level Wallet',
};

export default function WalletExchangePage() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const hasFetchedRef = useRef(false);
  
  const [fromWalletType, setFromWalletType] = useState<string>('');
  const [toWalletType, setToWalletType] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [dailyLimitStatus, setDailyLimitStatus] = useState<Record<string, boolean>>({});
  // Exchange rate is fixed at 1.0 (removed user input)
  const exchangeRate = 1.0;

  useEffect(() => {
    // Prevent duplicate calls (React StrictMode in development)
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    
    fetchWallets();

    // No cleanup - we want to prevent duplicate calls even on remount
  }, []);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getUserWallets();
      if (response.data) {
        setWallets(response.data.wallets || []);
        // Check daily limit status for Career Level and ROI wallets
        await checkDailyLimitStatus(response.data.wallets || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch wallets');
    } finally {
      setLoading(false);
    }
  };

  const checkDailyLimitStatus = async (walletList: Wallet[]) => {
    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check for Career Level and ROI wallets
      const careerLevelWallet = walletList.find(w => w.type === 'career_level');
      const roiWallet = walletList.find(w => w.type === 'roi');

      const status: Record<string, boolean> = {};

      if (careerLevelWallet || roiWallet) {
        // Fetch recent transactions to check if already exchanged today
        const reportsResponse = await api.getUserReports();
        if (reportsResponse.data) {
          // Check all transactions for today's exchanges
          const allTransactions = [
            ...(reportsResponse.data.roi || []),
            ...(reportsResponse.data.careerLevel || []),
            ...(reportsResponse.data.referral || []),
            ...(reportsResponse.data.binary || []),
          ];

          allTransactions.forEach((tx: any) => {
            const txDate = new Date(tx.createdAt || tx.date);
            if (txDate >= today && txDate < tomorrow) {
              // Check if this is a wallet exchange debit transaction
              if (tx.type === 'debit' && tx.meta?.type === 'wallet_exchange') {
                // Check fromWallet in meta to see which wallet was exchanged from
                const fromWallet = tx.meta?.fromWallet;
                if (fromWallet === 'career_level') {
                  status.career_level = true; // Already exchanged today
                } else if (fromWallet === 'roi') {
                  status.roi = true; // Already exchanged today
                }
              }
            }
          });
        }
      }

      setDailyLimitStatus(status);
    } catch (err) {
      // Silently fail - daily limit check is not critical for UI
      console.error('Failed to check daily limit status:', err);
    }
  };

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!fromWalletType || !toWalletType || !amount) {
      setError('Please fill in all fields');
      return;
    }

    // Validate: Only allow exchange FROM referral, binary, career_level, or roi wallets
    const allowedFromWallets = ['referral', 'binary', 'career_level', 'roi'];
    if (!allowedFromWallets.includes(fromWalletType)) {
      setError('You can only exchange from Referral, Binary, Career Level, or ROI wallets');
      return;
    }

    // Check daily limit for Career Level and ROI wallets
    if ((fromWalletType === 'career_level' || fromWalletType === 'roi') && dailyLimitStatus[fromWalletType]) {
      const walletName = fromWalletType === 'career_level' ? 'Career Level' : 'ROI';
      setError(`You have already exchanged from ${walletName} wallet today. You can only exchange once per day from this wallet.`);
      return;
    }

    // Validate: Only allow exchange TO withdrawal wallet
    if (toWalletType !== 'withdrawal') {
      setError('You can only exchange to Withdrawal wallet');
      return;
    }

    if (fromWalletType === toWalletType) {
      setError('Source and destination wallets cannot be the same');
      return;
    }

    const exchangeAmount = parseFloat(amount);
    if (isNaN(exchangeAmount) || exchangeAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Check available balance
    const fromWallet = wallets.find(w => w.type === fromWalletType);
    if (!fromWallet) {
      setError('Source wallet not found');
      return;
    }

    const availableBalance = fromWallet.balance - fromWallet.reserved;
    if (exchangeAmount > availableBalance) {
      setError(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`);
      return;
    }

    try {
      setExchanging(true);
      // Exchange rate is fixed at 1.0
      const response = await api.exchangeWalletFunds({
        fromWalletType,
        toWalletType,
        amount: exchangeAmount,
        exchangeRate: 1.0, // Fixed at 1:1
      });

      if (response.data) {
        setSuccess(
          `Successfully exchanged $${exchangeAmount.toFixed(2)} from ${WALLET_TYPE_LABELS[fromWalletType] || fromWalletType} to ${WALLET_TYPE_LABELS[toWalletType] || toWalletType}. ` +
          `Received: $${response.data.toWallet.amountCredited.toFixed(2)}`
        );
        // Reset form
        setFromWalletType('');
        setToWalletType('');
        setAmount('');
        // Refresh wallets and daily limit status
        await fetchWallets();
      }
    } catch (err: any) {
      setError(err.message || 'Exchange failed');
    } finally {
      setExchanging(false);
    }
  };

  const getAvailableBalance = (walletType: string) => {
    const wallet = wallets.find(w => w.type === walletType);
    if (!wallet) return 0;
    return wallet.balance - wallet.reserved;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
          <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
            <p className="mt-4 text-gray-600">Loading wallets...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Wallet Exchange</h1>
          </div>
          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Exchange Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Exchange Funds</h2>
                
                <form onSubmit={handleExchange} className="space-y-4">
                  {/* From Wallet */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Wallet
                    </label>
                    <select
                      value={fromWalletType}
                      onChange={(e) => setFromWalletType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Select source wallet</option>
                      {wallets
                        .filter((wallet) => 
                          wallet.type === 'referral' || 
                          wallet.type === 'binary' || 
                          wallet.type === 'career_level' || 
                          wallet.type === 'roi'
                        )
                        .map((wallet) => {
                          const available = getAvailableBalance(wallet.type);
                          const isDailyLimitReached = dailyLimitStatus[wallet.type];
                          const dailyLimitText = (wallet.type === 'career_level' || wallet.type === 'roi') && isDailyLimitReached
                            ? ' (Daily limit reached)'
                            : '';
                          return (
                            <option 
                              key={wallet.type} 
                              value={wallet.type}
                              disabled={isDailyLimitReached}
                            >
                              {WALLET_TYPE_LABELS[wallet.type] || wallet.type} - Available: ${available.toFixed(2)}{dailyLimitText}
                            </option>
                          );
                        })}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      You can exchange from Referral, Binary, Career Level, or ROI wallets
                    </p>
                    {(fromWalletType === 'career_level' || fromWalletType === 'roi') && dailyLimitStatus[fromWalletType] && (
                      <p className="mt-1 text-xs text-red-600 font-medium">
                        ⚠️ You have already exchanged from this wallet today. Daily limit: 1 exchange per day.
                      </p>
                    )}
                    {(fromWalletType === 'career_level' || fromWalletType === 'roi') && !dailyLimitStatus[fromWalletType] && (
                      <p className="mt-1 text-xs text-amber-600 font-medium">
                        ℹ️ Daily limit: You can exchange from this wallet once per day.
                      </p>
                    )}
                    {fromWalletType && (
                      <p className="mt-1 text-sm text-gray-500">
                        Available: ${getAvailableBalance(fromWalletType).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* To Wallet */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      To Wallet
                    </label>
                    <select
                      value={toWalletType}
                      onChange={(e) => setToWalletType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Select destination wallet</option>
                      {wallets
                        .filter((wallet) => wallet.type === 'withdrawal')
                        .map((wallet) => (
                          <option key={wallet.type} value={wallet.type}>
                            {WALLET_TYPE_LABELS[wallet.type] || wallet.type}
                          </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Funds can only be transferred to Withdrawal wallet
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount (USD)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="0.01"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter amount"
                      required
                    />
                    {fromWalletType && amount && (
                      <p className="mt-1 text-sm text-gray-500">
                        Max: ${getAvailableBalance(fromWalletType).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Exchange Rate is fixed at 1:1 - hidden from user */}
                  {amount && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>Exchange Rate:</strong> 1:1 (Fixed)
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        You will receive: <strong>${parseFloat(amount).toFixed(2)}</strong> in Withdrawal wallet
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={exchanging || !fromWalletType || !toWalletType || !amount}
                    className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {exchanging ? 'Exchanging...' : 'Exchange Funds'}
                  </button>
                </form>
              </div>
            </div>

            {/* Wallet Balances */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Wallet Balances</h2>
                <div className="space-y-3">
                  {wallets.map((wallet) => {
                    const available = getAvailableBalance(wallet.type);
                    return (
                      <div key={wallet.type} className="border-b border-gray-200 pb-3 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {WALLET_TYPE_LABELS[wallet.type] || wallet.type}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Reserved: ${wallet.reserved.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              ${wallet.balance.toFixed(2)}
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              Available: ${available.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}

