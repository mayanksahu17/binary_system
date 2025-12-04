'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Investment {
  id: string;
  package: {
    id: string;
    name: string;
    roi: number;
    duration: number;
  } | null;
  investedAmount: number;
  depositAmount: number;
  type: string;
  isBinaryUpdated: boolean;
  createdAt: string;
  expiresOn?: string;
}

export default function InvestmentsPage() {
  const router = useRouter();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvestments();
  }, []);

  const fetchInvestments = async () => {
    try {
      setLoading(true);
      const response = await api.getUserInvestments();
      if (response.data) {
        setInvestments(response.data.investments);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load investments');
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysRemaining = (expiresOn?: string) => {
    if (!expiresOn) return null;
    const expiry = new Date(expiresOn);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
          <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
            <p className="mt-4 text-gray-600">Loading investments...</p>
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

      <div>
            {investments.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 text-lg mb-4">No investments yet</p>
                <button
                  onClick={() => router.push('/plans')}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Browse Plans
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {investments.map((inv) => {
                  const daysRemaining = calculateDaysRemaining(inv.expiresOn);
                  return (
                    <div key={inv.id} className="bg-white rounded-lg shadow-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {inv.package?.name || 'Unknown Package'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            inv.isBinaryUpdated
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {inv.isBinaryUpdated ? 'Active' : 'Processing'}
                        </span>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-gray-600">Invested Amount:</span>
                          <span className="font-bold text-lg text-indigo-600">
                            ${inv.investedAmount.toFixed(2)}
                          </span>
                        </div>
                        {inv.package && (
                          <>
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-gray-600">ROI:</span>
                              <span className="font-semibold">{inv.package.roi}%</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-gray-600">Duration:</span>
                              <span className="font-semibold">{inv.package.duration} days</span>
                            </div>
                          </>
                        )}
                        {inv.expiresOn && (
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-gray-600">Days Remaining:</span>
                            <span className={`font-semibold ${daysRemaining && daysRemaining < 7 ? 'text-red-600' : 'text-green-600'}`}>
                              {daysRemaining !== null ? `${daysRemaining} days` : 'Expired'}
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
    </div>
  );
}

