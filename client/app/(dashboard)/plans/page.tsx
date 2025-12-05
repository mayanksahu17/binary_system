'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

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
  const { user } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const processingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls (React StrictMode in development)
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    
    fetchPackages();

    // No cleanup - we want to prevent duplicate calls even on remount
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

  const handleInvestNow = async (pkg: Package) => {
    setSelectedPackage(pkg);
    setInvestAmount(pkg.minAmount.toString());
    setSelectedVoucherId(null);
    setShowInvestModal(true);
    setError('');
    
    // Fetch available vouchers
    await fetchAvailableVouchers();
  };

  const fetchAvailableVouchers = async () => {
    try {
      setLoadingVouchers(true);
      const response = await api.getUserVouchers({ status: 'active' });
      console.log('Vouchers response:', response);
      
      if (response.data?.vouchers) {
        // Filter vouchers that are not expired
        const now = new Date();
        const validVouchers = response.data.vouchers.filter((v: any) => {
          if (v.status !== 'active') {
            console.log('Voucher filtered out - status:', v.status, v.voucherId);
            return false;
          }
          if (v.expiry) {
            const expiryDate = new Date(v.expiry);
            if (expiryDate <= now) {
              console.log('Voucher filtered out - expired:', v.voucherId, expiryDate);
              return false;
            }
          }
          return true;
        });
        console.log('Valid vouchers:', validVouchers);
        setAvailableVouchers(validVouchers);
      } else {
        console.log('No vouchers in response');
        setAvailableVouchers([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch vouchers:', err);
      // Don't show error, just continue without vouchers
      setAvailableVouchers([]);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const handleCreatePayment = async () => {
    // Prevent double-click/duplicate submission
    if (processingRef.current || creatingPayment) {
      return;
    }

    if (!selectedPackage || !investAmount) {
      setError('Please enter an investment amount');
      return;
    }

    const amount = parseFloat(investAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount < selectedPackage.minAmount || amount > selectedPackage.maxAmount) {
      setError(`Amount must be between $${selectedPackage.minAmount.toLocaleString()} and $${selectedPackage.maxAmount.toLocaleString()}`);
      return;
    }

    if (selectedPackage.status !== 'Active') {
      setError('This package is not active');
      return;
    }

    try {
      processingRef.current = true;
      setCreatingPayment(true);
      setError('');
      
      const response = await api.createPayment({
        packageId: selectedPackage.id,
        amount,
        currency: 'USD',
        voucherId: selectedVoucherId || undefined,
      });

      // Check if investment was created directly (payment gateway disabled)
      if (response.data?.investment) {
        // Investment created directly without payment
        setError('');
        setShowInvestModal(false);
        setSelectedPackage(null);
        setInvestAmount('');
        setSelectedVoucherId(null);
        processingRef.current = false;
        // Show success message or redirect
        alert('Investment created successfully!');
        // Optionally reload the page or redirect to investments page
        window.location.href = '/investments';
        return;
      }

      if (response.data?.payment?.paymentUrl) {
        // If payment status is "completed" (free payment when NOWPayments is disabled), redirect to success page
        if (response.data?.payment?.status === 'completed') {
          console.log('Free payment created, redirecting to success page:', response.data.payment.paymentUrl);
          processingRef.current = false;
          window.location.href = response.data.payment.paymentUrl;
        } else {
          // Redirect to NOWPayments payment page
          console.log('Redirecting to NOWPayments:', response.data.payment.paymentUrl);
          processingRef.current = false;
          window.location.href = response.data.payment.paymentUrl;
        }
      } else {
        // Check if we can construct payment URL from payment ID
        if (response.data?.payment?.paymentId) {
          const constructedUrl = `https://nowpayments.io/payment/?iid=${response.data.payment.paymentId}`;
          console.log('Redirecting to NOWPayments (constructed URL):', constructedUrl);
          window.location.href = constructedUrl;
        } else if (response.data?.payment?.payAddress) {
          setError('Payment address received but payment URL is not available. Please contact support with payment address: ' + response.data.payment.payAddress);
        } else {
          console.error('Payment response:', response);
          setError('Failed to get payment URL. Please check the console for details or contact support.');
        }
      }
    } catch (err: any) {
      console.error('Payment creation error:', err);
      setError(err.message || 'Failed to create payment. Please ensure NOWPayments is configured.');
      setCreatingPayment(false);
      processingRef.current = false;
    }
  };


  if (loading) {
    return (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
              <p className="mt-4 text-gray-600">Loading packages...</p>
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
                    {/* {pkg.roi && pkg.roi !== dailyRoiRate * 100 && (
                      <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        <span className="font-medium">Legacy ROI:</span> {pkg.roi}%
                      </div>
                    )} */}

                    <button
                      onClick={() => handleInvestNow(pkg)}
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

        {/* Investment Modal */}
        {showInvestModal && selectedPackage && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Make Investment</h3>
                
                <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="font-semibold text-gray-800 mb-2">{selectedPackage.packageName}</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Amount Range:</span>
                      <span className="font-medium">${selectedPackage.minAmount.toLocaleString()} - ${selectedPackage.maxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="font-medium">{selectedPackage.duration} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Output:</span>
                      <span className="font-medium text-green-600">{(selectedPackage.totalOutputPct || 225)}%</span>
                    </div>
                  </div>
                </div>

                {/* Voucher Selection */}
                {loadingVouchers ? (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">Loading vouchers...</p>
                  </div>
                ) : availableVouchers.length > 0 ? (
                  <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Use Voucher (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      💡 Tip: Vouchers can be used for investments up to their investment value. A $100 voucher (investment value $200) can cover any investment from $100 to $200.
                    </p>
                    <select
                      value={selectedVoucherId || ''}
                      onChange={(e) => setSelectedVoucherId(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                    >
                      <option value="">No voucher</option>
                      {availableVouchers.map((voucher: any) => {
                        const voucherInvestmentValue = voucher.investmentValue || voucher.amount * 2;
                        return (
                          <option key={voucher.voucherId} value={voucher.voucherId}>
                            ${voucher.amount.toLocaleString()} voucher (Covers up to $${voucherInvestmentValue.toLocaleString()})
                            {voucher.expiry && ` - Expires: ${new Date(voucher.expiry).toLocaleDateString()}`}
                          </option>
                        );
                      })}
                    </select>
                    {selectedVoucherId && (() => {
                      const selectedVoucher = availableVouchers.find((v: any) => v.voucherId === selectedVoucherId);
                      if (selectedVoucher) {
                        const voucherValue = selectedVoucher.investmentValue || selectedVoucher.amount * 2;
                        const investmentAmount = parseFloat(investAmount) || 0;
                        const remainingAmount = Math.max(0, investmentAmount - voucherValue);
                        // Voucher covers full amount if investment amount is less than or equal to voucher investment value
                        const voucherCoversFull = investmentAmount > 0 && voucherValue >= investmentAmount;
                        
                        return (
                          <div className="text-sm text-gray-600 space-y-2">
                            <div className="flex justify-between">
                              <span>Voucher Investment Value:</span>
                              <span className="font-semibold text-green-600">${voucherValue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Your Investment Amount:</span>
                              <span className="font-semibold text-gray-900">${investmentAmount.toLocaleString()}</span>
                            </div>
                            {voucherCoversFull ? (
                              <div className="p-2 bg-green-50 border border-green-200 rounded">
                                <div className="text-green-700 font-semibold flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Voucher fully covers your investment!
                                </div>
                                <div className="text-xs text-green-600 mt-1">
                                  No additional payment required. Investment will be activated immediately.
                                </div>
                              </div>
                            ) : remainingAmount > 0 ? (
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Remaining to Pay:</span>
                                  <span className="font-semibold text-orange-600">${remainingAmount.toLocaleString()}</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Voucher covers ${voucherValue.toLocaleString()}, pay remaining ${remainingAmount.toLocaleString()} via payment gateway
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">No active vouchers available. <a href="/vouchers" className="text-indigo-600 hover:underline">Create one?</a></p>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={`Enter amount (${selectedPackage.minAmount} - ${selectedPackage.maxAmount})`}
                  />
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowInvestModal(false);
                      setSelectedPackage(null);
                      setInvestAmount('');
                      setSelectedVoucherId(null);
                      setError('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePayment}
                    disabled={creatingPayment}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {creatingPayment ? 'Creating Payment...' : 'Proceed to Payment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

