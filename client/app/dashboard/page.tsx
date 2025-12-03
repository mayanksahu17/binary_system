'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Wallet {
  type: string;
  balance: number;
  reserved: number;
  currency: string;
}

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
  const { user, logout } = useAuth();
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [binaryTree, setBinaryTree] = useState<BinaryTreeInfo | null>(null);
  const [referralLinks, setReferralLinks] = useState<{ leftLink: string; rightLink: string; userId: string } | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [bankAccount, setBankAccount] = useState({
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    accountHolderName: '',
  });
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investing, setInvesting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [walletsRes, packagesRes, investmentsRes, binaryTreeRes, referralLinksRes, userProfileRes] = await Promise.all([
        api.getUserWallets(),
        api.getUserPackages(),
        api.getUserInvestments(),
        api.getUserBinaryTree().catch(() => ({ data: null })), // Don't fail if binary tree not found
        api.getUserReferralLinks().catch(() => ({ data: null })), // Don't fail if referral links not found
        api.getUserProfile().catch(() => ({ data: null })), // Get user profile for wallet address
      ]);

      if (walletsRes.data) setWallets(walletsRes.data.wallets);
      if (packagesRes.data) setPackages(packagesRes.data.packages);
      if (investmentsRes.data) setInvestments(investmentsRes.data.investments);
      if (binaryTreeRes.data) setBinaryTree(binaryTreeRes.data.binaryTree);
      if (referralLinksRes.data) setReferralLinks(referralLinksRes.data);
      if (userProfileRes.data?.user) {
        if (userProfileRes.data.user.walletAddress) {
          setWalletAddress(userProfileRes.data.user.walletAddress);
        }
        if (userProfileRes.data.user.bankAccount) {
          setBankAccount({
            accountNumber: userProfileRes.data.user.bankAccount.accountNumber || '',
            bankName: userProfileRes.data.user.bankAccount.bankName || '',
            ifscCode: userProfileRes.data.user.bankAccount.ifscCode || '',
            accountHolderName: userProfileRes.data.user.bankAccount.accountHolderName || '',
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
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
        // Update wallets, investments, and binary tree
        setWallets(response.data.wallets);
        if (response.data.binaryTree) {
          setBinaryTree(response.data.binaryTree);
        }
        await fetchDashboardData();
        setShowInvestModal(false);
        setSelectedPackage(null);
        setInvestAmount('');
        alert('Investment successful! Your binary bonuses have been calculated.');
      }
    } catch (err: any) {
      setError(err.message || 'Investment failed');
    } finally {
      setInvesting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
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
    };
    return names[type] || type;
  };

  if (loading) {
    return (
      <ProtectedRoute requireUser>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">User Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">Welcome, {user?.name}</span>
                <button
                  onClick={() => router.push('/plans')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Plans
                </button>
                <button
                  onClick={() => router.push('/investments')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Investments
                </button>
                <button
                  onClick={() => router.push('/binary')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Binary Info
                </button>
                <button
                  onClick={() => router.push('/my-tree')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  My Tree
                </button>
                <button
                  onClick={() => router.push('/wallet-exchange')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Wallet Exchange
                </button>
                <button
                  onClick={() => router.push('/reports')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Reports
                </button>
                <button
                  onClick={() => router.push('/vouchers')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Vouchers
                </button>
                <button
                  onClick={() => router.push('/withdraw')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Withdraw
                </button>
                <button
                  onClick={handleLogout}
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

          {/* Wallets Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">My Wallets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wallets.map((wallet) => (
                <div key={wallet.type} className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getWalletDisplayName(wallet.type)}
                  </h3>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">
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

          {/* Packages Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Available Packages</h2>
              <button
                onClick={() => {
                  setSelectedPackage(null);
                  setInvestAmount('');
                  setShowInvestModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                + Invest Now
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {/* Investments Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">My Investments</h2>
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
              <h2 className="text-xl font-bold mb-4">Referral Links</h2>
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
                          alert('Left referral link copied!');
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
                          alert('Right referral link copied!');
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

          {/* Binary Tree Info Section */}
          {binaryTree && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4">Binary Tree Information</h2>
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
        </div>

        {/* Investment Modal */}
        {showInvestModal && (
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
                    min={selectedPackage?.minAmount || 0}
                    max={selectedPackage?.maxAmount || 100000}
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

        {/* Wallet Address & Bank Account Section */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Payment Information</h2>
              <button
                onClick={() => setShowWalletModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                {walletAddress || bankAccount.accountNumber ? 'Update' : 'Setup'} Payment Info
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Bank Account</h3>
                {bankAccount.accountNumber ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-gray-800">
                      <strong>Account:</strong> {bankAccount.accountNumber}
                    </p>
                    {bankAccount.bankName && (
                      <p className="text-sm text-gray-800 mt-1">
                        <strong>Bank:</strong> {bankAccount.bankName}
                      </p>
                    )}
                    {bankAccount.ifscCode && (
                      <p className="text-sm text-gray-800 mt-1">
                        <strong>IFSC:</strong> {bankAccount.ifscCode}
                      </p>
                    )}
                    <p className="text-xs text-green-600 mt-1">✓ Bank account configured</p>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">No bank account set</p>
                    <p className="text-xs text-yellow-600 mt-1">Optional (alternative to wallet address)</p>
                  </div>
                )}
              </div>
            </div>
            {!walletAddress && !bankAccount.accountNumber && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-semibold text-red-800 mb-1">⚠️ Payment Information Required</p>
                <p className="text-xs text-red-700">
                  You need to set either a wallet address or bank account details to request withdrawals.
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

                  {/* Bank Account Section */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800 mb-3">Bank Account (Alternative)</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={bankAccount.accountNumber}
                          onChange={(e) => setBankAccount({ ...bankAccount, accountNumber: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Enter bank account number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={bankAccount.bankName}
                          onChange={(e) => setBankAccount({ ...bankAccount, bankName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Enter bank name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            IFSC Code
                          </label>
                          <input
                            type="text"
                            value={bankAccount.ifscCode}
                            onChange={(e) => setBankAccount({ ...bankAccount, ifscCode: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter IFSC code"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Account Holder Name
                          </label>
                          <input
                            type="text"
                            value={bankAccount.accountHolderName}
                            onChange={(e) => setBankAccount({ ...bankAccount, accountHolderName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter account holder name"
                          />
                        </div>
                      </div>
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
                      if (!walletAddress && !bankAccount.accountNumber) {
                        setError('Please set at least a wallet address or bank account number');
                        return;
                      }
                      try {
                        await api.updateWalletAddress({ 
                          walletAddress: walletAddress || undefined,
                          bankAccount: bankAccount.accountNumber ? bankAccount : undefined
                        });
                        setShowWalletModal(false);
                        alert('Payment information updated successfully!');
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
    </ProtectedRoute>
  );
}

