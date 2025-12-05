'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

interface Statistics {
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  totalDeposits: string;
  totalWithdrawals: string;
  totalInvestment: string;
  totalVoucherInvestment: string;
  totalFreeInvestment: string;
  totalPowerlegInvestment: string;
  totalROI: string;
  totalReferralBonus: string;
  totalBinaryBonus: string;
}

export default function AdminDashboard() {
  const { user, admin, loading: authLoading } = useAuth();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cronLoading, setCronLoading] = useState(false);
  const [flushLoading, setFlushLoading] = useState(false);
  const [nowpaymentsEnabled, setNowpaymentsEnabled] = useState<boolean | null>(null);
  const [nowpaymentsLoading, setNowpaymentsLoading] = useState(false);

  // Route protection is handled in layout

  useEffect(() => {
    const isAdminUser = user?.userId === 'CROWN-000000';
    const isAdminAccount = !!admin;

    if (isAdminUser || isAdminAccount) {
      fetchStatistics();
      fetchNOWPaymentsStatus();
    }
  }, [user, admin]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getAdminStatistics();
      if (response.data) {
        setStatistics(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch statistics');
      console.error('Error fetching statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCron = async () => {
    if (!confirm('Are you sure you want to trigger the daily calculations (ROI, Binary, Referral)?')) {
      return;
    }

    try {
      setCronLoading(true);
      const response = await api.triggerDailyCalculations({
        includeROI: true,
        includeBinary: true,
        includeReferral: true,
      });
      
      if (response.data) {
        toast.success('Daily calculations triggered successfully!');
        // Refresh statistics after cron
        setTimeout(() => {
          fetchStatistics();
        }, 2000);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger daily calculations');
      console.error('Error triggering cron:', err);
    } finally {
      setCronLoading(false);
    }
  };

  const handleFlushInvestments = async () => {
    const confirmMessage = '⚠️ WARNING: This will permanently delete ALL investments and related data for ALL users!\n\n' +
      'This action will:\n' +
      '• Delete all investments\n' +
      '• Delete all ROI, Binary, and Referral transactions\n' +
      '• Reset ROI, Binary, and Referral wallet balances to zero\n' +
      '• Reset all binary tree business volumes to zero\n\n' +
      'Users will NOT be deleted, but all their investment data will be lost.\n\n' +
      'This action CANNOT be undone. Are you absolutely sure?';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    // Double confirmation
    if (!confirm('FINAL CONFIRMATION: Are you 100% certain you want to flush all investment data?')) {
      return;
    }

    try {
      setFlushLoading(true);
      setError('');
      const response = await api.flushAllInvestments();
      
      if (response.data) {
        toast.success(
          `All investments flushed successfully! Investments deleted: ${response.data.investmentsDeleted}, Transactions deleted: ${response.data.transactionsDeleted}`,
          { duration: 5000 }
        );
        // Refresh statistics after flush
        setTimeout(() => {
          fetchStatistics();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to flush investments');
      toast.error(err.message || 'Failed to flush investments');
      console.error('Error flushing investments:', err);
    } finally {
      setFlushLoading(false);
    }
  };

  const fetchNOWPaymentsStatus = async () => {
    try {
      const response = await api.getNOWPaymentsStatus();
      if (response.data) {
        setNowpaymentsEnabled(response.data.enabled);
      }
    } catch (err: any) {
      console.error('Error fetching NOWPayments status:', err);
      // Default to true if error (for backward compatibility)
      setNowpaymentsEnabled(true);
    }
  };

  const handleToggleNOWPayments = async () => {
    if (nowpaymentsEnabled === null) return;

    const newStatus = !nowpaymentsEnabled;
    const confirmMessage = newStatus
      ? 'Are you sure you want to enable NOWPayments gateway? Users will be able to make real payments.'
      : 'Are you sure you want to disable NOWPayments gateway? Users will not be able to make payments until it is re-enabled.';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setNowpaymentsLoading(true);
      const response = await api.updateNOWPaymentsStatus(newStatus);
      if (response.data) {
        setNowpaymentsEnabled(response.data.enabled);
        toast.success(`NOWPayments gateway ${newStatus ? 'enabled' : 'disabled'} successfully!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update NOWPayments status');
      console.error('Error updating NOWPayments status:', err);
    } finally {
      setNowpaymentsLoading(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
  };

  if (authLoading || loading) {
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
        <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Overview of system statistics and controls</p>
        </div>
            <div className="flex gap-3">
            <button
              onClick={handleTriggerCron}
              disabled={cronLoading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cronLoading ? 'Processing...' : 'Trigger Daily Calculations'}
            </button>
            <button
                onClick={handleFlushInvestments}
                disabled={flushLoading}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {flushLoading ? 'Flushing...' : 'Flush All Investments'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Payment Gateway Settings */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Payment Gateway Settings</h3>
              <p className="text-sm text-gray-600">Control NOWPayments gateway for development and testing</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-medium ${nowpaymentsEnabled ? 'text-green-600' : 'text-red-600'}`}>
                {nowpaymentsEnabled === null ? 'Loading...' : nowpaymentsEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={handleToggleNOWPayments}
                disabled={nowpaymentsEnabled === null || nowpaymentsLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  nowpaymentsEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                } ${(nowpaymentsEnabled === null || nowpaymentsLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    nowpaymentsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          {nowpaymentsEnabled === false && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> NOWPayments gateway is disabled. Users will not be able to make payments until it is re-enabled.
              </p>
            </div>
          )}
        </div>

        {statistics && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Users</h3>
                <p className="text-2xl font-bold text-gray-900">{statistics.totalUsers.toLocaleString()}</p>
                <div className="mt-4 flex gap-4 text-xs">
                  <span className="text-gray-600">Verified: <span className="font-semibold text-gray-900">{statistics.verifiedUsers.toLocaleString()}</span></span>
                  <span className="text-gray-600">Unverified: <span className="font-semibold text-gray-900">{statistics.unverifiedUsers.toLocaleString()}</span></span>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Deposits & Investment</h3>
                <p className="text-2xl font-bold text-indigo-600">{formatCurrency(statistics.totalInvestment)}</p>
                <p className="text-xs text-gray-500 mt-2">Combined deposits and investments</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total Withdrawals</h3>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.totalWithdrawals)}</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Investment Breakdown Chart */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      {
                        name: 'Voucher',
                        amount: parseFloat(statistics.totalVoucherInvestment),
                      },
                      {
                        name: 'Free',
                        amount: parseFloat(statistics.totalFreeInvestment),
                      },
                      {
                        name: 'Powerleg',
                        amount: parseFloat(statistics.totalPowerlegInvestment),
                      },
                    ]}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis 
                      stroke="#6b7280"
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                    />
                    <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>

              {/* Earnings Breakdown Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      {
                        name: 'ROI',
                        amount: parseFloat(statistics.totalROI),
                      },
                      {
                        name: 'Referral',
                        amount: parseFloat(statistics.totalReferralBonus),
                      },
                      {
                        name: 'Binary',
                        amount: parseFloat(statistics.totalBinaryBonus),
                      },
                    ]}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis 
                      stroke="#6b7280"
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                    />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Financial Flow Chart */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Overview</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: 'Deposits & Investment', amount: parseFloat(statistics.totalInvestment) },
                    { name: 'Withdrawals', amount: parseFloat(statistics.totalWithdrawals) },
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis 
                    stroke="#6b7280"
                    tickFormatter={(value) => {
                      if (value === 0) return '$0';
                      if (value < 1000) return `$${value.toFixed(0)}`;
                      return `$${(value / 1000).toFixed(1)}k`;
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                  />
                  <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

    </div>
  );
}

