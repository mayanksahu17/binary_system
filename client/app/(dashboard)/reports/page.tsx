'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  status: string;
  txRef?: string;
  meta?: any;
  createdAt: string;
  investment?: {
    id: string;
    packageName: string;
    roi: number;
    duration: number;
    investedAmount: number;
    type: string;
    createdAt: string;
  } | null;
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

export default function ReportsPage() {
  const { user } = useAuth();
  const [roiTransactions, setRoiTransactions] = useState<Transaction[]>([]);
  const [binaryTransactions, setBinaryTransactions] = useState<Transaction[]>([]);
  const [referralTransactions, setReferralTransactions] = useState<Transaction[]>([]);
  const [careerLevelTransactions, setCareerLevelTransactions] = useState<Transaction[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'roi' | 'binary' | 'referral' | 'careerLevel' | 'investment' | 'withdrawal'>('roi');
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls (React StrictMode in development)
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    
    fetchReports();

    // No cleanup - we want to prevent duplicate calls even on remount
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.getUserReports();
      if (response.data) {
        setRoiTransactions(response.data.roi || []);
        setBinaryTransactions(response.data.binary || []);
        setReferralTransactions(response.data.referral || []);
        setCareerLevelTransactions(response.data.careerLevel || []);
        setInvestmentTransactions(response.data.investment || []);
        setWithdrawals(response.data.withdrawals || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string, headers: string[], getRow: (item: any) => string[]) => {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(item => getRow(item).map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTransactions = (transactions: Transaction[], title: string) => {
    exportToCSV(
      transactions,
      title.toLowerCase().replace(/\s+/g, '_'),
      ['Date & Time', 'Type', 'Amount', 'Status', 'Transaction ID'],
      (tx) => [
        new Date(tx.createdAt).toLocaleString(),
        tx.type.toUpperCase(),
        `$${tx.amount.toFixed(2)}`,
        tx.status,
        tx.txRef || tx.id.substring(0, 8) || 'N/A'
      ]
    );
  };

  const exportInvestmentTransactions = (transactions: Transaction[]) => {
    exportToCSV(
      transactions,
      'investment_transactions',
      ['Date & Time', 'Type', 'Amount', 'Package Name', 'ROI %', 'Duration (days)', 'Invested Amount', 'Investment Type', 'Status', 'Transaction ID'],
      (tx) => [
        new Date(tx.createdAt).toLocaleString(),
        tx.type.toUpperCase(),
        `$${tx.amount.toFixed(2)}`,
        tx.investment?.packageName || 'N/A',
        tx.investment?.roi?.toString() || '0',
        tx.investment?.duration?.toString() || '0',
        `$${tx.investment?.investedAmount.toFixed(2) || '0.00'}`,
        tx.investment?.type || 'N/A',
        tx.status,
        tx.txRef || tx.id.substring(0, 8) || 'N/A'
      ]
    );
  };

  const exportWithdrawals = (withdrawals: Withdrawal[]) => {
    exportToCSV(
      withdrawals,
      'withdrawals',
      ['Date & Time', 'Withdrawal ID', 'Amount', 'Charges', 'Final Amount', 'Wallet Type', 'Method', 'Status'],
      (wd) => [
        new Date(wd.createdAt).toLocaleString(),
        wd.withdrawalId || wd.id.substring(0, 8),
        `$${wd.amount.toFixed(2)}`,
        `$${wd.charges.toFixed(2)}`,
        `$${wd.finalAmount.toFixed(2)}`,
        wd.walletType,
        wd.method || 'crypto',
        wd.status
      ]
    );
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  };

  const renderTransactionTable = (transactions: Transaction[], title: string, showExport: boolean = true) => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {showExport && transactions.length > 0 && (
          <button
            onClick={() => exportTransactions(transactions, title)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Export CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const { date, time } = formatDateTime(tx.createdAt);
                return (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="text-gray-900 font-medium">{date}</div>
                      <div className="text-gray-500 text-xs">{time}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                        tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                      {tx.txRef || tx.id.substring(0, 8) || 'N/A'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInvestmentTable = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Investment Transactions</h3>
        {investmentTransactions.length > 0 && (
          <button
            onClick={() => exportInvestmentTransactions(investmentTransactions)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Export CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI %</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invested Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {investmentTransactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                  No investment transactions found
                </td>
              </tr>
            ) : (
              investmentTransactions.map((tx) => {
                const { date, time } = formatDateTime(tx.createdAt);
                return (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="text-gray-900 font-medium">{date}</div>
                      <div className="text-gray-500 text-xs">{time}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {tx.investment?.packageName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tx.investment?.roi || 0}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${tx.investment?.investedAmount.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tx.investment?.duration || 0} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                        tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                      {tx.txRef || tx.id.substring(0, 8) || 'N/A'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderWithdrawalTable = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Withdrawal History</h3>
        {withdrawals.length > 0 && (
          <button
            onClick={() => exportWithdrawals(withdrawals)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Export CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Withdrawal ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charges</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Final Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {withdrawals.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  No withdrawals found
                </td>
              </tr>
            ) : (
              withdrawals.map((wd) => {
                const { date, time } = formatDateTime(wd.createdAt);
                return (
                  <tr key={wd.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="text-gray-900 font-medium">{date}</div>
                      <div className="text-gray-500 text-xs">{time}</div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {wd.method || 'crypto'}
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
          <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
            <p className="mt-4 text-gray-600">Loading reports...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          </div>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

      <div>
          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                  {(['roi', 'binary', 'referral', 'careerLevel', 'investment', 'withdrawal'] as const).map((tab) => (
                  <button
                    key={tab}
                      onClick={() => setActiveTab(tab)}
                    className={`${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
                  >
                      {tab === 'careerLevel' ? 'Career Level' : tab} {tab === 'roi' && `(${roiTransactions.length})`}
                      {tab === 'binary' && `(${binaryTransactions.length})`}
                      {tab === 'referral' && `(${referralTransactions.length})`}
                      {tab === 'careerLevel' && `(${careerLevelTransactions.length})`}
                      {tab === 'investment' && `(${investmentTransactions.length})`}
                      {tab === 'withdrawal' && `(${withdrawals.length})`}
                  </button>
                ))}
              </nav>
            </div>
          </div>

            {/* Content */}
            {activeTab === 'roi' && renderTransactionTable(roiTransactions, 'ROI Transactions')}
            {activeTab === 'binary' && renderTransactionTable(binaryTransactions, 'Binary Bonus Transactions')}
            {activeTab === 'referral' && renderTransactionTable(referralTransactions, 'Referral Bonus Transactions')}
            {activeTab === 'careerLevel' && renderTransactionTable(careerLevelTransactions, 'Career Level Transactions')}
            {activeTab === 'investment' && renderInvestmentTable()}
            {activeTab === 'withdrawal' && renderWithdrawalTable()}
          </div>
        </div>
  );
}
