'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function BinaryReportPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getBinaryReport();
      if (response.data) {
        setReport(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
      toast.error(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!report) return;

    const headers = ['Date', 'User ID', 'User Name', 'User Email', 'Type', 'Amount', 'Balance Before', 'Balance After', 'Status'];
    const rows = report.transactions.map((tx: any) => [
      new Date(tx.createdAt).toLocaleString(),
      tx.userId,
      tx.userName,
      tx.userEmail,
      tx.type.toUpperCase(),
      `$${tx.amount.toFixed(2)}`,
      `$${tx.balanceBefore.toFixed(2)}`,
      `$${tx.balanceAfter.toFixed(2)}`,
      tx.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row: any[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `binary_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Transactions</h3>
              <p className="text-2xl font-bold text-gray-900">{report.summary.totalTransactions}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Credits</h3>
              <p className="text-2xl font-bold text-green-600">
                ${report.summary.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Business</h3>
              <p className="text-2xl font-bold text-indigo-600">
                ${report.summary.totalBusiness.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Left Business</h3>
              <p className="text-2xl font-bold text-blue-600">
                ${report.summary.totalLeftBusiness.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Right Business</h3>
              <p className="text-2xl font-bold text-purple-600">
                ${report.summary.totalRightBusiness.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Binary Transactions ({report.transactions.length})</h3>
              {report.transactions.length > 0 && (
                <button
                  onClick={exportToCSV}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance Before</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance After</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    report.transactions.map((tx: any) => (
                      <tr key={tx.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                          {tx.userId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tx.userName}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${tx.balanceBefore.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${tx.balanceAfter.toFixed(2)}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

