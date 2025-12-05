'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Package {
  id: string;
  packageName: string;
  minAmount: number;
  maxAmount: number;
  roi: number;
  duration: number;
  status: string;
}

interface User {
  id: string;
  userId: string;
  name: string;
  email: string;
}

export default function AdminInvestmentsPage() {
  const { admin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    packageId: '',
    amount: '',
  });
  const [userSearch, setUserSearch] = useState('');
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, packagesRes] = await Promise.all([
        api.getAdminUsers({ page: 1, limit: 1000 }),
        api.getPackages({ status: 'active' }),
      ]);
      
      if (usersRes.data) {
        setUsers(usersRes.data.users || []);
      }
      if (packagesRes.data) {
        setPackages(packagesRes.data.packages || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userId || !formData.packageId || !formData.amount) {
      toast.error('Please fill in all fields');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const selectedPackage = packages.find(p => p.id === formData.packageId);
    if (selectedPackage) {
      if (amount < selectedPackage.minAmount || amount > selectedPackage.maxAmount) {
        toast.error(`Amount must be between $${selectedPackage.minAmount} and $${selectedPackage.maxAmount}`);
        return;
      }
    }

    setCreating(true);
    try {
      await api.adminCreateInvestment({
        userId: formData.userId,
        packageId: formData.packageId,
        amount,
        type: 'admin',
      });
      toast.success('Investment created successfully!');
      setFormData({ userId: '', packageId: '', amount: '' });
      setUserSearch('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create investment');
    } finally {
      setCreating(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.userId.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const selectedPackage = packages.find(p => p.id === formData.packageId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Create Investment for User</h1>
        <p className="mt-1 text-sm text-gray-500">Create investments on behalf of users</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Selection */}
          <div>
            <label htmlFor="userSearch" className="block text-sm font-medium text-gray-700 mb-2">
              Search User <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="userSearch"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                if (!e.target.value) {
                  setFormData({ ...formData, userId: '' });
                }
              }}
              placeholder="Search by User ID, Name, or Email"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            {userSearch && filteredUsers.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, userId: user.id });
                      setUserSearch(`${user.userId} - ${user.name}`);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{user.userId}</div>
                    <div className="text-sm text-gray-500">{user.name} {user.email && `(${user.email})`}</div>
                  </button>
                ))}
              </div>
            )}
            {formData.userId && (
              <p className="mt-1 text-sm text-green-600">✓ User selected</p>
            )}
          </div>

          {/* Package Selection */}
          <div>
            <label htmlFor="packageId" className="block text-sm font-medium text-gray-700 mb-2">
              Package <span className="text-red-500">*</span>
            </label>
            <select
              id="packageId"
              required
              value={formData.packageId}
              onChange={(e) => setFormData({ ...formData, packageId: e.target.value, amount: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a package</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.packageName} (${pkg.minAmount} - ${pkg.maxAmount})
                </option>
              ))}
            </select>
            {selectedPackage && (
              <div className="mt-2 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-gray-700">
                  <strong>ROI:</strong> {selectedPackage.roi}% | <strong>Duration:</strong> {selectedPackage.duration} days
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Amount Range:</strong> ${selectedPackage.minAmount} - ${selectedPackage.maxAmount}
                </p>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Investment Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="amount"
              required
              min={selectedPackage?.minAmount || 0}
              max={selectedPackage?.maxAmount || 999999}
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Enter investment amount"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            {selectedPackage && formData.amount && (
              <p className="mt-1 text-sm text-gray-500">
                Must be between ${selectedPackage.minAmount} and ${selectedPackage.maxAmount}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={creating || !formData.userId || !formData.packageId || !formData.amount}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Investment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

