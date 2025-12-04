'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface Package {
  _id?: string;
  id?: string; // Some APIs return id instead of _id
  packageName: string;
  minAmount: string | number | any; // Can be number, Decimal128, or string
  maxAmount: string | number | any;
  duration: number;
  totalOutputPct?: number;
  renewablePrinciplePct?: number;
  referralPct?: number;
  binaryPct?: number;
  powerCapacity?: string | number | any;
  status: 'Active' | 'InActive';
  // Legacy fields
  roi?: number;
  binaryBonus?: number;
  cappingLimit?: string | number | any;
  principleReturn?: number;
  levelOneReferral?: number;
}

export default function PackagesPage() {
  const router = useRouter();
  const { user, admin, loading: authLoading, logout } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState<Partial<Package>>({
    packageName: '',
    minAmount: '',
    maxAmount: '',
    duration: 150,
    status: 'Active',
    // Legacy fields (matching seedPackages structure)
    roi: 1.75,
    binaryBonus: 10,
    cappingLimit: '0',
    principleReturn: 50,
    levelOneReferral: 7,
  });

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
      fetchPackages();
    }
  }, [page, user, admin]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getPackages({ page, limit: 25 });
      if (response.data) {
        setPackages(response.data.packages);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch packages');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package? This action cannot be undone.')) return;

    try {
      setError('');
      setSuccess('');
      await api.deletePackage(id);
      setSuccess('Package deleted successfully');
      fetchPackages();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete package');
      setTimeout(() => setError(''), 5000);
    }
  };

  // Helper function to extract value from MongoDB Decimal128 format
  const extractDecimalValue = (value: any): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    
    // Handle MongoDB extended JSON format: { "$numberDecimal": "100" }
    if (typeof value === 'object' && value.$numberDecimal !== undefined) {
      const num = parseFloat(value.$numberDecimal);
      return isNaN(num) ? null : num;
    }
    
    // Handle Decimal128 objects with toString method
    if (typeof value === 'object' && typeof value.toString === 'function') {
      const num = parseFloat(value.toString());
      return isNaN(num) ? null : num;
    }
    
    // Handle plain numbers
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    // Handle strings
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    
    return null;
  };

  const formatAmount = (amount: string | number | any) => {
    const num = extractDecimalValue(amount);
    if (num === null) {
      return '0.00';
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleOpenModal = (pkg?: Package) => {
    if (pkg) {
      setEditingPackage(pkg);
      // Extract values from MongoDB Decimal128 format for form display
      const minAmt = extractDecimalValue(pkg.minAmount);
      const maxAmt = extractDecimalValue(pkg.maxAmount);
      const powerCap = extractDecimalValue(pkg.powerCapacity);
      const capLimit = powerCap ?? extractDecimalValue(pkg.cappingLimit) ?? 0;
      
      setFormData({
        packageName: pkg.packageName || '',
        minAmount: minAmt !== null ? String(minAmt) : '',
        maxAmount: maxAmt !== null ? String(maxAmt) : '',
        duration: pkg.duration || 150,
        status: pkg.status || 'Active',
        // Legacy fields (from seedPackages)
        roi: pkg.roi || pkg.totalOutputPct || 1.75,
        binaryBonus: pkg.binaryBonus || pkg.binaryPct || 10,
        cappingLimit: capLimit !== null ? String(capLimit) : '0',
        principleReturn: pkg.principleReturn || pkg.renewablePrinciplePct || 50,
        levelOneReferral: pkg.levelOneReferral || pkg.referralPct || 7,
        // New fields
        totalOutputPct: pkg.totalOutputPct || pkg.roi,
        binaryPct: pkg.binaryPct || pkg.binaryBonus,
        powerCapacity: powerCap !== null ? String(powerCap) : '0',
        renewablePrinciplePct: pkg.renewablePrinciplePct || pkg.principleReturn,
        referralPct: pkg.referralPct || pkg.levelOneReferral,
      });
    } else {
      setEditingPackage(null);
      setFormData({
        packageName: '',
        minAmount: '',
        maxAmount: '',
        duration: 150,
        status: 'Active',
        roi: 1.75,
        binaryBonus: 10,
        cappingLimit: '0',
        principleReturn: 50,
        levelOneReferral: 7,
      });
    }
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      
      const submitData = {
        packageName: formData.packageName,
        minAmount: formData.minAmount,
        maxAmount: formData.maxAmount,
        duration: formData.duration,
        status: formData.status,
        // Legacy fields (matching seedPackages)
        roi: formData.roi,
        binaryBonus: formData.binaryBonus,
        cappingLimit: formData.cappingLimit,
        principleReturn: formData.principleReturn,
        levelOneReferral: formData.levelOneReferral,
        // New fields (if provided)
        ...(formData.totalOutputPct && { totalOutputPct: formData.totalOutputPct }),
        ...(formData.binaryPct && { binaryPct: formData.binaryPct }),
        ...(formData.powerCapacity && { powerCapacity: formData.powerCapacity }),
        ...(formData.renewablePrinciplePct && { renewablePrinciplePct: formData.renewablePrinciplePct }),
        ...(formData.referralPct && { referralPct: formData.referralPct }),
      };

      const packageId = editingPackage?._id || editingPackage?.id;
      if (packageId) {
        await api.updatePackage(packageId, submitData);
        setSuccess('Package updated successfully');
      } else {
        await api.createPackage(submitData);
        setSuccess('Package created successfully');
      }
      
      setShowModal(false);
      fetchPackages();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save package');
      setTimeout(() => setError(''), 5000);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading packages...</p>
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Package Management</h1>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => handleOpenModal()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              + Add Package
            </button>
            <button
              onClick={async () => {
                await logout(true);
                router.push('/');
              }}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all"
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

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">All Packages</h3>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages} ({packages.length} packages)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Package Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min/Max Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ROI %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Binary Bonus %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Referral %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capping Limit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Principle Return %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {packages.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-4 text-center text-sm text-gray-500">
                      No packages found. Click "Add Package" to create one.
                    </td>
                  </tr>
                ) : (
                  packages.map((pkg) => {
                    // Handle minAmount - extract from MongoDB Decimal128 format
                    const minAmt = extractDecimalValue(pkg.minAmount) ?? 0;
                    
                    // Handle maxAmount - extract from MongoDB Decimal128 format
                    const maxAmt = extractDecimalValue(pkg.maxAmount) ?? 0;
                    
                    // Handle cappingLimit/powerCapacity - prefer powerCapacity
                    const capLimit = extractDecimalValue(pkg.powerCapacity) ?? extractDecimalValue(pkg.cappingLimit) ?? 0;
                    
                    // Handle ROI - prefer legacy roi for display, fallback to totalOutputPct
                    const roiValue = pkg.roi !== null && pkg.roi !== undefined && pkg.roi !== 0
                      ? pkg.roi
                      : (pkg.totalOutputPct !== null && pkg.totalOutputPct !== undefined ? pkg.totalOutputPct : null);
                    
                    // Handle Binary Bonus
                    const binaryValue = pkg.binaryBonus !== null && pkg.binaryBonus !== undefined && pkg.binaryBonus !== 0
                      ? pkg.binaryBonus
                      : (pkg.binaryPct !== null && pkg.binaryPct !== undefined ? pkg.binaryPct : null);
                    
                    // Handle Referral
                    const referralValue = pkg.levelOneReferral !== null && pkg.levelOneReferral !== undefined && pkg.levelOneReferral !== 0
                      ? pkg.levelOneReferral
                      : (pkg.referralPct !== null && pkg.referralPct !== undefined ? pkg.referralPct : null);
                    
                    // Handle Principle Return
                    const principleValue = pkg.principleReturn !== null && pkg.principleReturn !== undefined && pkg.principleReturn !== 0
                      ? pkg.principleReturn
                      : (pkg.renewablePrinciplePct !== null && pkg.renewablePrinciplePct !== undefined ? pkg.renewablePrinciplePct : null);

                    return (
                      <tr key={pkg._id || pkg.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {pkg.packageName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${formatAmount(minAmt)} - ${formatAmount(maxAmt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pkg.duration} days
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {roiValue !== null && roiValue !== undefined && typeof roiValue === 'number' 
                            ? `${roiValue.toFixed(2)}%` 
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {binaryValue !== null && binaryValue !== undefined && typeof binaryValue === 'number'
                            ? `${binaryValue.toFixed(2)}%`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {referralValue !== null && referralValue !== undefined && typeof referralValue === 'number'
                            ? `${referralValue.toFixed(2)}%`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${formatAmount(capLimit)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {principleValue !== null && principleValue !== undefined && typeof principleValue === 'number'
                            ? `${principleValue.toFixed(2)}%`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              pkg.status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {pkg.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleOpenModal(pkg)}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(pkg._id || pkg.id!)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingPackage ? 'Edit Package' : 'Create New Package'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                <input
                  type="text"
                  required
                  value={formData.packageName || ''}
                  onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Solar Starter"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount ($) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.minAmount || ''}
                    onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount ($) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.maxAmount || ''}
                    onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="2000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.duration || 150}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 150 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="150"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ROI % *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.roi || ''}
                    onChange={(e) => setFormData({ ...formData, roi: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="1.75"
                  />
                  <p className="mt-1 text-xs text-gray-500">Daily ROI percentage</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Binary Bonus % *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.binaryBonus || ''}
                    onChange={(e) => setFormData({ ...formData, binaryBonus: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="10.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">Binary matching percentage</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level One Referral % *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.levelOneReferral || ''}
                    onChange={(e) => setFormData({ ...formData, levelOneReferral: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="9"
                  />
                  <p className="mt-1 text-xs text-gray-500">First level referral bonus</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principle Return % *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.principleReturn || ''}
                    onChange={(e) => setFormData({ ...formData, principleReturn: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="50.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">Percentage of principle returned</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capping Limit ($) *</label>
                <input
                  type="text"
                  required
                  value={formData.cappingLimit || ''}
                  onChange={(e) => setFormData({ ...formData, cappingLimit: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="2000.00"
                />
                <p className="mt-1 text-xs text-gray-500">Maximum binary matching cap (use "0" for no limit)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  value={formData.status || 'Active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'InActive' })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Active">Active</option>
                  <option value="InActive">InActive</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                >
                  {editingPackage ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}