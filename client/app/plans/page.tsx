'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Package {
  id: string;
  packageName: string;
  minAmount: number;
  maxAmount: number;
  duration: number;
  // New fields
  totalOutputPct?: number; // Total output percentage (e.g., 225%)
  renewablePrinciplePct?: number; // Renewable principle percentage (e.g., 50%)
  referralPct?: number; // Referral bonus percentage (e.g., 7%)
  binaryPct?: number; // Binary bonus percentage (e.g., 10%)
  powerCapacity?: number; // Power capacity / capping limit (e.g., 1000)
  status?: 'Active' | 'InActive';
  // Legacy fields (for backward compatibility)
  roi?: number; // Daily ROI percentage (deprecated, use totalOutputPct)
  binaryBonus?: number; // (deprecated, use binaryPct)
  cappingLimit?: number; // (deprecated, use powerCapacity)
  principleReturn?: number; // (deprecated, use renewablePrinciplePct)
  levelOneReferral?: number; // (deprecated, use referralPct)
}

export default function PlansPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investing, setInvesting] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await api.getUserPackages();
      if (response.data) {
        setPackages(response.data.packages);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const handleInvest = async () => {
    if (!selectedPackage || !investAmount) {
      setError('Please select a package and enter amount');
      return;
    }

    const amount = parseFloat(investAmount);
    if (amount < selectedPackage.minAmount || amount > selectedPackage.maxAmount) {
      setError(`Amount must be between $${selectedPackage.minAmount} and $${selectedPackage.maxAmount}`);
      return;
    }

    try {
      setInvesting(true);
      setError('');
      const response = await api.createInvestment({
        packageId: selectedPackage.id,
        amount,
        currency: 'USD',
      });

      if (response.data) {
        setShowInvestModal(false);
        setSelectedPackage(null);
        setInvestAmount('');
        alert('Investment successful! Redirecting to investments page...');
        router.push('/investments');
      }
    } catch (err: any) {
      setError(err.message || 'Investment failed');
    } finally {
      setInvesting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requireUser>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading packages...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireUser>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
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
                <h1 className="text-2xl font-bold text-gray-900">Investment Plans</h1>
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

        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {packages.length === 0 && !loading && (
            <div className="px-4 py-6 sm:px-0">
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500 text-lg">No active packages available at the moment.</p>
              </div>
            </div>
          )}

          {packages.length > 0 && (
            <div className="px-4 py-6 sm:px-0">
              <div className="mb-4 text-sm text-gray-600">
                Showing {packages.length} active package{packages.length !== 1 ? 's' : ''}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map((pkg) => {
                // Calculate daily ROI rate from totalOutputPct or use legacy roi
                const totalOutputPct = pkg.totalOutputPct || (pkg.roi ? pkg.roi * pkg.duration : 225);
                const dailyRoiRate = (totalOutputPct / 100) / pkg.duration;
                const renewablePrinciplePct = pkg.renewablePrinciplePct || pkg.principleReturn || 50;
                const referralPct = pkg.referralPct || pkg.levelOneReferral || 7;
                const binaryPct = pkg.binaryPct || pkg.binaryBonus || 10;
                const powerCapacity = pkg.powerCapacity || pkg.cappingLimit || 1000;
                const status = pkg.status || 'Active';

                return (
                  <div key={pkg.id} className="bg-white rounded-lg shadow-lg p-6 border-2 border-indigo-100 hover:border-indigo-300 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-gray-800">{pkg.packageName}</h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {status}
                      </span>
                    </div>
                    
                    <div className="space-y-3 mb-4">
                      {/* Investment Amount Range */}
                      <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Investment Range</p>
                        <p className="text-lg font-bold text-indigo-700">
                          ${pkg.minAmount.toLocaleString()} - ${pkg.maxAmount.toLocaleString()}
                        </p>
                      </div>

                      {/* Duration */}
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">Duration:</span>
                        <span className="text-sm font-semibold text-gray-800">{pkg.duration} days</span>
                      </div>

                      {/* Total Output Percentage */}
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">Total Output:</span>
                        <span className="text-sm font-semibold text-green-600">{totalOutputPct}%</span>
                      </div>

                      {/* Daily ROI Rate */}
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">Daily ROI Rate:</span>
                        <span className="text-sm font-semibold text-blue-600">{(dailyRoiRate * 100).toFixed(4)}%</span>
                      </div>

                      {/* Renewable Principle */}
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">Renewable Principle:</span>
                        <span className="text-sm font-semibold text-purple-600">{renewablePrinciplePct}%</span>
                      </div>

                      {/* Referral Bonus */}
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">Referral Bonus:</span>
                        <span className="text-sm font-semibold text-orange-600">{referralPct}%</span>
                      </div>

                      {/* Binary Bonus */}
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">Binary Bonus:</span>
                        <span className="text-sm font-semibold text-pink-600">{binaryPct}%</span>
                      </div>

                      {/* Power Capacity / Capping Limit */}
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm font-medium text-gray-600">Power Capacity:</span>
                        <span className="text-sm font-semibold text-gray-800">${powerCapacity.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Legacy ROI (if different from calculated) */}
                    {pkg.roi && pkg.roi !== dailyRoiRate * 100 && (
                      <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        <span className="font-medium">Legacy ROI:</span> {pkg.roi}%
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setInvestAmount(pkg.minAmount.toString());
                        setShowInvestModal(true);
                      }}
                      disabled={status !== 'Active'}
                      className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
                    >
                      {status === 'Active' ? 'Invest Now' : 'Package Inactive'}
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* Investment Modal */}
        {showInvestModal && selectedPackage && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Make Investment</h3>
                {selectedPackage && (
                  <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h4 className="font-semibold text-gray-800 mb-3">{selectedPackage.packageName}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Amount Range:</span>
                        <span className="ml-2 font-medium">${selectedPackage.minAmount} - ${selectedPackage.maxAmount}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-medium">{selectedPackage.duration} days</span>
                      </div>
                      {selectedPackage.totalOutputPct && (
                        <div>
                          <span className="text-gray-600">Total Output:</span>
                          <span className="ml-2 font-medium text-green-600">{selectedPackage.totalOutputPct}%</span>
                        </div>
                      )}
                      {selectedPackage.referralPct && (
                        <div>
                          <span className="text-gray-600">Referral Bonus:</span>
                          <span className="ml-2 font-medium text-orange-600">{selectedPackage.referralPct}%</span>
                        </div>
                      )}
                      {selectedPackage.binaryPct && (
                        <div>
                          <span className="text-gray-600">Binary Bonus:</span>
                          <span className="ml-2 font-medium text-pink-600">{selectedPackage.binaryPct}%</span>
                        </div>
                      )}
                      {selectedPackage.renewablePrinciplePct && (
                        <div>
                          <span className="text-gray-600">Renewable Principle:</span>
                          <span className="ml-2 font-medium text-purple-600">{selectedPackage.renewablePrinciplePct}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Investment Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    min={selectedPackage.minAmount}
                    max={selectedPackage.maxAmount}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter amount"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowInvestModal(false);
                      setSelectedPackage(null);
                      setInvestAmount('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInvest}
                    disabled={investing}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {investing ? 'Processing...' : 'Invest'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

