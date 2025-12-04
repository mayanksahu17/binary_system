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
  const [nowpaymentsEnabled, setNowpaymentsEnabled] = useState<boolean | null>(null);
  const [nowpaymentsLoading, setNowpaymentsLoading] = useState(false);

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
        alert(`NOWPayments gateway ${newStatus ? 'enabled' : 'disabled'} successfully!`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update NOWPayments status');
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
              onClick={async () => {
                await logout(true);
                router.push('/');
              }}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
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

