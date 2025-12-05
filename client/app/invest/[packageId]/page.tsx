'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface Package {
  id: string;
  packageName: string;
  minAmount: number;
  maxAmount: number;
  duration: number;
  totalOutputPct?: number;
  renewablePrinciplePct?: number;
  referralPct?: number;
  binaryPct?: number;
  powerCapacity?: number;
  status?: 'Active' | 'InActive';
  roi?: number;
  binaryBonus?: number;
  cappingLimit?: number;
  principleReturn?: number;
  levelOneReferral?: number;
}

function InvestContent() {
  const router = useRouter();
  const params = useParams();
  const packageId = params?.packageId as string;
  const { user } = useAuth();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [investAmount, setInvestAmount] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [loadingVouchers, setLoadingVouchers] = useState(false);

  useEffect(() => {
    if (packageId) {
      fetchPackage();
      fetchAvailableVouchers();
    }
  }, [packageId]);

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

  const fetchPackage = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getUserPackages();
      if (response.data?.packages) {
        const foundPackage = response.data.packages.find((p: Package) => p.id === packageId || (p as any)._id === packageId);
        if (foundPackage) {
          // Normalize package data
          const normalizedPkg: Package = {
            id: foundPackage.id || (foundPackage as any)._id,
            packageName: foundPackage.packageName,
            minAmount: typeof foundPackage.minAmount === 'object' && (foundPackage.minAmount as any).$numberDecimal
              ? parseFloat((foundPackage.minAmount as any).$numberDecimal)
              : typeof foundPackage.minAmount === 'number'
              ? foundPackage.minAmount
              : parseFloat(String(foundPackage.minAmount)),
            maxAmount: typeof foundPackage.maxAmount === 'object' && (foundPackage.maxAmount as any).$numberDecimal
              ? parseFloat((foundPackage.maxAmount as any).$numberDecimal)
              : typeof foundPackage.maxAmount === 'number'
              ? foundPackage.maxAmount
              : parseFloat(String(foundPackage.maxAmount)),
            duration: foundPackage.duration,
            totalOutputPct: foundPackage.totalOutputPct,
            renewablePrinciplePct: foundPackage.renewablePrinciplePct,
            referralPct: foundPackage.referralPct,
            binaryPct: foundPackage.binaryPct,
            powerCapacity: foundPackage.powerCapacity,
            status: foundPackage.status,
            roi: foundPackage.roi,
            binaryBonus: foundPackage.binaryBonus,
            cappingLimit: foundPackage.cappingLimit,
            principleReturn: foundPackage.principleReturn,
            levelOneReferral: foundPackage.levelOneReferral,
          };
          setPkg(normalizedPkg);
          setInvestAmount(normalizedPkg.minAmount.toString());
        } else {
          setError('Package not found');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load package');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!pkg || !investAmount) {
      setError('Please enter an investment amount');
      return;
    }

    const amount = parseFloat(investAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount < pkg.minAmount || amount > pkg.maxAmount) {
      setError(`Amount must be between $${pkg.minAmount.toLocaleString()} and $${pkg.maxAmount.toLocaleString()}`);
      return;
    }

    if (pkg.status !== 'Active') {
      setError('This package is not active');
      return;
    }

    try {
      setCreatingPayment(true);
      setError('');
      
      const response = await api.createPayment({
        packageId: pkg.id,
        amount,
        currency: 'USD',
        voucherId: selectedVoucherId || undefined,
      });

      // Check if investment was created directly (payment gateway disabled)
      if (response.data?.investment) {
        // Investment created directly without payment
        setError('');
        // Show success message and redirect
        alert('Investment created successfully!');
        router.push('/investments');
        return;
      }

      if (response.data?.payment?.paymentUrl) {
        // Redirect to NOWPayments payment page
        window.location.href = response.data.payment.paymentUrl;
      } else if (response.data?.payment?.payAddress) {
        // If payment URL is not provided, show payment address
        setPaymentUrl(response.data.payment.payAddress);
        setError('Payment URL not available. Please contact support.');
      } else {
        setError('Failed to create payment. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create payment');
    } finally {
      setCreatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading package details...</p>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Package Not Found</h1>
          <p className="text-gray-600 mb-6">The package you're looking for doesn't exist or is no longer available.</p>
          <button
            onClick={() => router.push('/plans')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Plans
          </button>
        </div>
      </div>
    );
  }

  const totalOutputPct = pkg.totalOutputPct || (pkg.roi ? pkg.roi * pkg.duration : 225);
  const renewablePrinciplePct = pkg.renewablePrinciplePct || pkg.principleReturn || 50;
  const referralPct = pkg.referralPct || pkg.levelOneReferral || 7;
  const binaryPct = pkg.binaryPct || pkg.binaryBonus || 10;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={() => router.push('/plans')}
            className="text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            ← Back to Plans
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Make Investment</h1>
          <div></div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Package Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{pkg.packageName}</h2>
                  <span className={`mt-2 inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                    pkg.status === 'Active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {pkg.status}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Investment Range</p>
                  <p className="text-xl font-bold text-indigo-700">
                    ${pkg.minAmount.toLocaleString()} - ${pkg.maxAmount.toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Duration</p>
                    <p className="text-lg font-semibold text-gray-900">{pkg.duration} days</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Total Output</p>
                    <p className="text-lg font-semibold text-green-600">{totalOutputPct}%</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Referral Bonus</p>
                    <p className="text-lg font-semibold text-orange-600">{referralPct}%</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Binary Bonus</p>
                    <p className="text-lg font-semibold text-pink-600">{binaryPct}%</p>
                  </div>
                </div>
              </div>

              {/* Investment Form */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Amount</h3>
                
                {/* Voucher Selection */}
                {availableVouchers.length > 0 && (
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
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
                        // IMPORTANT: Voucher can cover ANY investment up to its investment value
                        // Examples: $100 voucher (investment value $200) can cover:
                        // - $100 investment ✅ (fully covered)
                        // - $150 investment ✅ (fully covered)
                        // - $200 investment ✅ (fully covered)
                        // - $300 investment (partially covered - user pays $100)
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
                            {investmentAmount > 0 && voucherValue >= investmentAmount ? (
                              <div className="p-2 bg-green-50 border border-green-200 rounded">
                                <div className="text-green-700 font-semibold flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  ✓ Voucher covers your investment!
                                </div>
                                <div className="text-xs text-green-600 mt-1">
                                  Your ${investmentAmount.toLocaleString()} investment is fully covered. No additional payment required.
                                </div>
                              </div>
                            ) : investmentAmount > voucherValue ? (
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
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    min={pkg.minAmount}
                    max={pkg.maxAmount}
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                    placeholder={`Enter amount (${pkg.minAmount} - ${pkg.maxAmount})`}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Minimum: ${pkg.minAmount.toLocaleString()} | Maximum: ${pkg.maxAmount.toLocaleString()}
                  </p>
                </div>

                {investAmount && !isNaN(parseFloat(investAmount)) && (() => {
                  const selectedVoucher = selectedVoucherId ? availableVouchers.find((v: any) => v.voucherId === selectedVoucherId) : null;
                  const voucherValue = selectedVoucher ? (selectedVoucher.investmentValue || selectedVoucher.amount * 2) : 0;
                  const investmentAmount = parseFloat(investAmount);
                  const remainingAmount = Math.max(0, investmentAmount - voucherValue);
                  
                  return (
                    <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                      <h4 className="font-semibold text-gray-900 mb-2">Investment Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Investment Amount:</span>
                          <span className="font-semibold text-gray-900">${investmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {selectedVoucher && (
                          <>
                            <div className="flex justify-between border-t border-indigo-200 pt-2">
                              <span className="text-gray-600">Voucher Applied (Investment Value):</span>
                              <span className="font-semibold text-green-600">-${voucherValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            {remainingAmount > 0 ? (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Amount to Pay:</span>
                                <span className="font-semibold text-orange-600">${remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">Amount to Pay:</span>
                                <span className="font-semibold text-green-600 flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  $0.00 (Fully Covered)
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between border-t border-indigo-200 pt-2">
                          <span className="text-gray-600">Total Return ({totalOutputPct}%):</span>
                          <span className="font-semibold text-green-600">
                            ${(investmentAmount * (totalOutputPct / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-semibold text-gray-900">{pkg.duration} days</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={handleCreatePayment}
                  disabled={creatingPayment || pkg.status !== 'Active' || !investAmount}
                  className="w-full px-6 py-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all"
                >
                  {creatingPayment ? 'Creating Payment...' : 'Proceed to Payment'}
                </button>

                {paymentUrl && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Payment Address:</strong> {paymentUrl}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  You will be redirected to NOWPayments to complete your payment securely.
                </p>
                <p>
                  Payments are processed using cryptocurrency through NOWPayments secure payment gateway.
                </p>
                <div className="pt-4 border-t border-gray-200">
                  <p className="font-semibold text-gray-900 mb-2">What happens next?</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Click "Proceed to Payment"</li>
                    <li>Complete payment on NOWPayments</li>
                    <li>Your investment will be activated automatically</li>
                    <li>You'll receive a confirmation email</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvestPage() {
  return (
    <ProtectedRoute requireUser>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }>
        <InvestContent />
      </Suspense>
    </ProtectedRoute>
  );
}

