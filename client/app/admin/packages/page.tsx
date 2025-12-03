'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Package {
  _id?: string;
  packageName: string;
  minAmount: string;
  maxAmount: string;
  duration: number;
  totalOutputPct?: number;
  renewablePrinciplePct?: number;
  referralPct?: number;
  binaryPct?: number;
  powerCapacity?: string;
  status: 'Active' | 'InActive';
  // Legacy fields
  roi?: number;
  binaryBonus?: number;
  cappingLimit?: string;
  principleReturn?: number;
  levelOneReferral?: number;
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState<Package>({
    packageName: '',
    minAmount: '',
    maxAmount: '',
    duration: 150,
    totalOutputPct: 225,
    renewablePrinciplePct: 50,
    referralPct: 7,
    binaryPct: 10,
    powerCapacity: '1000',
    status: 'Active',
  });
  const { admin, logout, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchPackages();
  }, [page]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
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
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      await api.deletePackage(id);
      fetchPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to delete package');
    }
  };

  const handleLogout = async () => {
    await logout(true);
    router.push('/');
  };

  const handleOpenModal = (pkg?: Package) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        packageName: pkg.packageName || '',
        minAmount: pkg.minAmount || '',
        maxAmount: pkg.maxAmount || '',
        duration: pkg.duration || 150,
        totalOutputPct: pkg.totalOutputPct || pkg.roi || 225,
        renewablePrinciplePct: pkg.renewablePrinciplePct || pkg.principleReturn || 50,
        referralPct: pkg.referralPct || pkg.levelOneReferral || 7,
        binaryPct: pkg.binaryPct || pkg.binaryBonus || 10,
        powerCapacity: pkg.powerCapacity || pkg.cappingLimit || '1000',
        status: pkg.status || 'Active',
      });
    } else {
      setEditingPackage(null);
      setFormData({
        packageName: '',
        minAmount: '',
        maxAmount: '',
        duration: 150,
        totalOutputPct: 225,
        renewablePrinciplePct: 50,
        referralPct: 7,
        binaryPct: 10,
        powerCapacity: '1000',
        status: 'Active',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      if (editingPackage?._id) {
        await api.updatePackage(editingPackage._id, formData);
      } else {
        await api.createPackage(formData);
      }
      setShowModal(false);
      fetchPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to save package');
    }
  };

  if (loading && packages.length === 0) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading packages...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const isAdminUser = user?.userId === 'CROWN-000000';
  const isAdminAccount = !!admin;

  if (!isAdminUser && !isAdminAccount) {
    return null;
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/admin/dashboard')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Package Management</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">Welcome, {admin?.name || user?.name}</span>
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

          <div className="px-4 py-6 sm:px-0">
            <div className="mb-4 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
              </div>
              <button
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                + Add Package
              </button>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        PACKAGE NAME
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        MIN/MAX AMOUNT
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        DURATION
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        TOTAL OUTPUT %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        REFERRAL %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        BINARY %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        POWER CAPACITY
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        RENEWABLE %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        STATUS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {packages.map((pkg) => (
                      <tr key={pkg._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {pkg.packageName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${pkg.minAmount} - ${pkg.maxAmount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pkg.duration} days
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pkg.totalOutputPct || pkg.roi || '-'}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pkg.referralPct || pkg.levelOneReferral || '-'}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pkg.binaryPct || pkg.binaryBonus || '-'}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${pkg.powerCapacity || pkg.cappingLimit || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pkg.renewablePrinciplePct || pkg.principleReturn || '-'}%
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
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(pkg._id!)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingPackage ? 'Edit Package' : 'Create New Package'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Package Name</label>
                    <input
                      type="text"
                      required
                      value={formData.packageName}
                      onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Min Amount ($)</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={formData.minAmount}
                        onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Amount ($)</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={formData.maxAmount}
                        onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration (days)</label>
                    <input
                      type="number"
                      required
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Output %</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.totalOutputPct}
                      onChange={(e) => setFormData({ ...formData, totalOutputPct: parseFloat(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Total payout percentage over duration (e.g., 225 for 225%)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Referral Bonus %</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={formData.referralPct}
                        onChange={(e) => setFormData({ ...formData, referralPct: parseFloat(e.target.value) })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                      <p className="mt-1 text-xs text-gray-500">One-time referral bonus (e.g., 7 for 7%)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Binary Bonus %</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={formData.binaryPct}
                        onChange={(e) => setFormData({ ...formData, binaryPct: parseFloat(e.target.value) })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                      <p className="mt-1 text-xs text-gray-500">Binary matching percentage (e.g., 10 for 10%)</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Power Capacity ($)</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.powerCapacity}
                      onChange={(e) => setFormData({ ...formData, powerCapacity: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Capping limit for binary matching (e.g., 1000)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Renewable Principle %</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.renewablePrinciplePct}
                      onChange={(e) => setFormData({ ...formData, renewablePrinciplePct: parseFloat(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Percentage of ROI auto-reinvested (e.g., 50 for 50%)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'InActive' })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="Active">Active</option>
                      <option value="InActive">InActive</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      {editingPackage ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
