'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Wallet {
  type: string;
  balance: number;
  reserved: number;
  currency: string;
}

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

interface BinaryTreeInfo {
  parent: {
    id: string;
    userId: string;
    name: string;
  } | null;
  leftChild: {
    id: string;
    userId: string;
    name: string;
  } | null;
  rightChild: {
    id: string;
    userId: string;
    name: string;
  } | null;
  leftBusiness: number;
  rightBusiness: number;
  leftCarry: number;
  rightCarry: number;
  leftDownlines: number;
  rightDownlines: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [binaryTree, setBinaryTree] = useState<BinaryTreeInfo | null>(null);
  const [referralLinks, setReferralLinks] = useState<{ leftLink: string; rightLink: string; userId: string } | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voucherCount, setVoucherCount] = useState<{ total: number; active: number; used: number; expired: number }>({ total: 0, active: 0, used: 0, expired: 0 });
  const [directReferrals, setDirectReferrals] = useState<any[]>([]);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls (React StrictMode in development)
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    
    fetchDashboardData();
    fetchVoucherCount();

    // No cleanup - we want to prevent duplicate calls even on remount
  }, []);

  const fetchVoucherCount = async () => {
    try {
      const response = await api.getUserVouchers();
      if (response.data?.vouchers) {
        const vouchers = response.data.vouchers;
        const now = new Date();
        const active = vouchers.filter((v: any) => {
          if (v.status !== 'active') return false;
          if (v.expiry) {
            return new Date(v.expiry) > now;
          }
          return true;
        }).length;
        const used = vouchers.filter((v: any) => v.status === 'used').length;
        const expired = vouchers.filter((v: any) => {
          if (v.expiry) {
            return new Date(v.expiry) <= now;
          }
          return false;
        }).length;
        
        setVoucherCount({
          total: vouchers.length,
          active,
          used,
          expired,
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch voucher count:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [walletsRes, investmentsRes, binaryTreeRes, referralLinksRes, userProfileRes, directReferralsRes] = await Promise.all([
        api.getUserWallets(),
        api.getUserInvestments(),
        api.getUserBinaryTree().catch(() => ({ data: null })), // Don't fail if binary tree not found
        api.getUserReferralLinks().catch(() => ({ data: null })), // Don't fail if referral links not found
        api.getUserProfile().catch(() => ({ data: null })), // Get user profile for wallet address
        api.getUserDirectReferrals().catch(() => ({ data: { referrals: [], count: 0 } })), // Don't fail if no referrals
      ]);

      if (walletsRes.data) setWallets(walletsRes.data.wallets);
      if (investmentsRes.data) setInvestments(investmentsRes.data.investments);
      if (binaryTreeRes.data) setBinaryTree(binaryTreeRes.data.binaryTree);
      if (referralLinksRes.data) setReferralLinks(referralLinksRes.data);
      if (userProfileRes.data?.user) {
        if (userProfileRes.data.user.walletAddress) {
          setWalletAddress(userProfileRes.data.user.walletAddress);
        }
      }
      if (directReferralsRes.data) {
        setDirectReferrals(directReferralsRes.data.referrals || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getWalletDisplayName = (type: string) => {
    const names: { [key: string]: string } = {
      withdrawal: 'Withdrawal',
      roi: 'ROI',
      referral_binary: 'Referral Binary',
      interest: 'Interest',
      referral: 'Referral',
      binary: 'Binary Bonus',
      token: 'Token',
      investment: 'Investment',
      career_level: 'Career Level',
    };
    return names[type] || type;
  };

  if (loading) {
    return (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
              <p className="mt-4 text-gray-600">Loading dashboard...</p>
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

          {/* Statistics Cards */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Vouchers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{voucherCount.total}</p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-full">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex gap-2 text-xs">
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">Active: {voucherCount.active}</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Used: {voucherCount.used}</span>
                {voucherCount.expired > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded">Expired: {voucherCount.expired}</span>
                )}
              </div>
            </div>
          </div>

          {/* Wallets Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900">My Wallets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wallets.map((wallet) => (
                <div key={wallet.type} className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getWalletDisplayName(wallet.type)}
                  </h3>
                  <p className="text-3xl font-bold text-slate-700 mt-2">
                    ${wallet.balance.toFixed(2)}
                  </p>
                  {wallet.reserved > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Reserved: ${wallet.reserved.toFixed(2)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{wallet.currency}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Investments Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900">My Investments</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {investments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No investments yet
                      </td>
                    </tr>
                  ) : (
                    investments.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {inv.package?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${inv.investedAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {inv.package?.roi || 0}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              inv.isBinaryUpdated
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {inv.isBinaryUpdated ? 'Active' : 'Processing'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Referral Links Section */}
          {referralLinks && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Referral Links</h2>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <h3 className="font-semibold text-blue-700 mb-2">Left Referral Link</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={referralLinks.leftLink}
                        readOnly
                        className="flex-1 px-3 py-2 border border-blue-300 rounded-md bg-white text-sm"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(referralLinks.leftLink);
                          toast.success('Left referral link copied!');
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                    <h3 className="font-semibold text-purple-700 mb-2">Right Referral Link</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={referralLinks.rightLink}
                        readOnly
                        className="flex-1 px-3 py-2 border border-purple-300 rounded-md bg-white text-sm"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(referralLinks.rightLink);
                          toast.success('Right referral link copied!');
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Direct Referrals Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900">My Direct Referrals</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {directReferrals.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  You don't have any direct referrals yet. Share your referral links to start building your team.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined At</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {directReferrals.map((ref) => (
                        <tr key={ref.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                            {ref.userId || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ref.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ref.email || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ref.phone || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                            {ref.position || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ref.country || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ref.joinedAt ? new Date(ref.joinedAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                ref.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : ref.status === 'blocked' || ref.status === 'suspended'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {ref.status || 'unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Binary Tree Info Section */}
          {binaryTree && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Binary Tree Information</h2>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Business Values</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                        <span className="font-medium text-gray-700">Left Business:</span>
                        <span className="text-lg font-bold text-blue-600">${binaryTree.leftBusiness.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                        <span className="font-medium text-gray-700">Right Business:</span>
                        <span className="text-lg font-bold text-purple-600">${binaryTree.rightBusiness.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                        <span className="font-medium text-gray-700">Min Business:</span>
                        <span className="text-lg font-bold text-green-600">
                          ${Math.min(binaryTree.leftBusiness, binaryTree.rightBusiness).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                        <span className="font-medium text-gray-700">Binary Bonus (10%):</span>
                        <span className="text-lg font-bold text-yellow-600">
                          ${(Math.min(binaryTree.leftBusiness, binaryTree.rightBusiness) * 0.1).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Carry Forward</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="font-medium text-gray-700">Left Carry:</span>
                        <span className="text-lg font-bold text-gray-600">${binaryTree.leftCarry.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="font-medium text-gray-700">Right Carry:</span>
                        <span className="text-lg font-bold text-gray-600">${binaryTree.rightCarry.toFixed(2)}</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-gray-700 mb-2">Downlines</h4>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Left Downlines:</span>
                          <span className="font-semibold">{binaryTree.leftDownlines}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-gray-600">Right Downlines:</span>
                          <span className="font-semibold">{binaryTree.rightDownlines}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {(binaryTree.parent || binaryTree.leftChild || binaryTree.rightChild) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Tree Connections</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {binaryTree.parent && (
                        <div className="p-3 bg-indigo-50 rounded">
                          <p className="text-xs text-gray-500 mb-1">Parent</p>
                          <p className="font-semibold text-indigo-700">{binaryTree.parent.name}</p>
                          <p className="text-xs text-gray-500">{binaryTree.parent.userId}</p>
                        </div>
                      )}
                      {binaryTree.leftChild && (
                        <div className="p-3 bg-blue-50 rounded">
                          <p className="text-xs text-gray-500 mb-1">Left Child</p>
                          <p className="font-semibold text-blue-700">{binaryTree.leftChild.name}</p>
                          <p className="text-xs text-gray-500">{binaryTree.leftChild.userId}</p>
                        </div>
                      )}
                      {binaryTree.rightChild && (
                        <div className="p-3 bg-purple-50 rounded">
                          <p className="text-xs text-gray-500 mb-1">Right Child</p>
                          <p className="font-semibold text-purple-700">{binaryTree.rightChild.name}</p>
                          <p className="text-xs text-gray-500">{binaryTree.rightChild.userId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Wallet Address Section */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Payment Information</h2>
              <button
                onClick={() => setShowWalletModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                {walletAddress ? 'Update' : 'Setup'} Payment Info
              </button>
            </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Crypto Wallet Address</h3>
                {walletAddress ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm font-mono text-gray-800 break-all">{walletAddress}</p>
                    <p className="text-xs text-green-600 mt-1">✓ Wallet address configured</p>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">No wallet address set</p>
                    <p className="text-xs text-yellow-600 mt-1">Required for withdrawals</p>
                  </div>
                )}
              </div>
            {!walletAddress && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-semibold text-red-800 mb-1">⚠️ Payment Information Required</p>
                <p className="text-xs text-red-700">
                  You need to set a crypto wallet address to request withdrawals.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Wallet Address Modal */}
        {showWalletModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Setup Payment Information</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set at least one payment method (wallet address or bank account) to enable withdrawals.
                </p>
                
                <div className="space-y-6">
                  {/* Crypto Wallet Address Section */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800 mb-3">Crypto Wallet Address</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Wallet Address
                      </label>
                      <input
                        type="text"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter your crypto wallet address (e.g., Bitcoin, Ethereum, etc.)"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Enter your cryptocurrency wallet address for crypto withdrawals
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowWalletModal(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!walletAddress) {
                        setError('Please enter a crypto wallet address');
                        return;
                      }
                      try {
                        await api.updateWalletAddress({ 
                          walletAddress: walletAddress
                        });
                        setShowWalletModal(false);
                        toast.success('Payment information updated successfully!');
                        await fetchDashboardData();
                      } catch (err: any) {
                        setError(err.message || 'Failed to update payment information');
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

