'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

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
  const router = useRouter();
  const { user, admin, loading: authLoading, logout } = useAuth();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cronLoading, setCronLoading] = useState(false);
  const [flushLoading, setFlushLoading] = useState(false);

  // Route protection
  useEffect(() => {
    if (authLoading) return;

    const isAdminUser = user?.userId === 'CROWN-000000';
    const isAdminAccount = !!admin;

    if (!isAdminUser && !isAdminAccount) {
      router.push('/login');
    }
  }, [user, admin, authLoading, router]);

  useEffect(() => {
    const isAdminUser = user?.userId === 'CROWN-000000';
    const isAdminAccount = !!admin;

    if (isAdminUser || isAdminAccount) {
      fetchStatistics();
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
        alert('Daily calculations triggered successfully!');
        // Refresh statistics after cron
        setTimeout(() => {
          fetchStatistics();
        }, 2000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to trigger daily calculations');
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
        alert(
          `✅ All investments flushed successfully!\n\n` +
          `• Investments deleted: ${response.data.investmentsDeleted}\n` +
          `• Transactions deleted: ${response.data.transactionsDeleted}\n` +
          `• ${response.data.walletsReset}\n` +
          `• ${response.data.binaryTreesReset}`
        );
        // Refresh statistics after flush
        setTimeout(() => {
          fetchStatistics();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to flush investments');
      alert(err.message || 'Failed to flush investments');
      console.error('Error flushing investments:', err);
    } finally {
      setFlushLoading(false);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const isAdminUser = user?.userId === 'CROWN-000000';
  const isAdminAccount = !!admin;

  if (!isAdminUser && !isAdminAccount) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex gap-4">
            <button
              onClick={handleTriggerCron}
              disabled={cronLoading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <button
              onClick={async () => {
                await logout(true);
                router.push('/');
              }}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* User Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">User Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Users</span>
                  <span className="font-bold text-gray-900">{statistics.totalUsers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Verified Users</span>
                  <span className="font-bold text-green-600">{statistics.verifiedUsers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Unverified Users</span>
                  <span className="font-bold text-red-600">{statistics.unverifiedUsers.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Financial Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Financial Overview</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Deposits</span>
                  <span className="font-bold text-gray-900">{formatCurrency(statistics.totalDeposits)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Withdrawals</span>
                  <span className="font-bold text-gray-900">{formatCurrency(statistics.totalWithdrawals)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Investment</span>
                  <span className="font-bold text-indigo-600">{formatCurrency(statistics.totalInvestment)}</span>
                </div>
              </div>
            </div>

            {/* Investment Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Investment Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Voucher Investment</span>
                  <span className="font-bold text-gray-900">{formatCurrency(statistics.totalVoucherInvestment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Free Investment</span>
                  <span className="font-bold text-gray-900">{formatCurrency(statistics.totalFreeInvestment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Powerleg Investment</span>
                  <span className="font-bold text-gray-900">{formatCurrency(statistics.totalPowerlegInvestment)}</span>
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Total Earnings</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total ROI</span>
                  <span className="font-bold text-green-600">{formatCurrency(statistics.totalROI)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Referral Bonus</span>
                  <span className="font-bold text-blue-600">{formatCurrency(statistics.totalReferralBonus)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Binary Bonus</span>
                  <span className="font-bold text-purple-600">{formatCurrency(statistics.totalBinaryBonus)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/admin')}
            className="px-6 py-3 bg-white rounded-lg shadow hover:bg-gray-50 text-left"
          >
            <h3 className="font-semibold text-gray-900">User Management</h3>
            <p className="text-sm text-gray-500 mt-1">View and manage all users</p>
          </button>
          <button
            onClick={() => router.push('/admin/withdrawals')}
            className="px-6 py-3 bg-white rounded-lg shadow hover:bg-gray-50 text-left"
          >
            <h3 className="font-semibold text-gray-900">Withdrawal Management</h3>
            <p className="text-sm text-gray-500 mt-1">Approve or reject withdrawals</p>
          </button>
          <button
            onClick={() => router.push('/admin/packages')}
            className="px-6 py-3 bg-white rounded-lg shadow hover:bg-gray-50 text-left"
          >
            <h3 className="font-semibold text-gray-900">Package Management</h3>
            <p className="text-sm text-gray-500 mt-1">Manage investment packages</p>
          </button>
        </div>
      </div>
    </div>
  );
}

