'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface User {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  treeLink: string;
  totalInvestment: string;
  joinedAt: string;
}

export default function AdminPanel() {
  const { user, admin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 50 });
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: string; userName: string } | null>(null);

  // Route protection is handled in layout

  useEffect(() => {
    // Only fetch users if authorized
    const isAdminUser = user?.userId === 'CROWN-000000';
    const isAdminAccount = !!admin;

    if (isAdminUser || isAdminAccount) {
      fetchUsers();
    }
  }, [page, search, user, admin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getAdminUsers({ page, limit: 50, search });
      if (response.data) {
        setUsers(response.data.users || []);
        setPagination(response.data.pagination || { total: 0, pages: 0, limit: 50 });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const response = await api.impersonateUser(userId);
      if (response.data?.user && response.data?.token) {
        // Create a URL with the user token to open in a new tab
        // We'll use a special route that handles the impersonation token
        const impersonationUrl = `/impersonate?token=${encodeURIComponent(response.data.token)}&userId=${encodeURIComponent(userId)}`;
        
        // Open in new tab
        window.open(impersonationUrl, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to login as user');
      console.error('Error impersonating user:', err);
    }
  };

  const handleDeleteClick = (userId: string, userName: string) => {
    setDeleteConfirm({ userId, userName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      setDeletingUserId(deleteConfirm.userId);
      setError('');
      await api.deleteUser(deleteConfirm.userId);
      setDeleteConfirm(null);
      // Refresh the user list
      await fetchUsers();
      toast.success(`User ${deleteConfirm.userName} (${deleteConfirm.userId}) and all related data deleted successfully`, { duration: 5000 });
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
      console.error('Error deleting user:', err);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">Manage and track all users in the system</p>
        </div>
        <div className="bg-white shadow rounded-lg">

          {/* Search Bar */}
          <div className="px-6 py-4 border-b border-gray-200">
            <form onSubmit={handleSearch} className="flex gap-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, userId, or phone..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Search
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                    fetchUsers();
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 py-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="px-6 py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-500">Loading users...</p>
            </div>
          )}

          {/* Users Table */}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mobile
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Investment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tree Link
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-mono">{user.userId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{user.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              user.status
                            )}`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-semibold">
                            ${parseFloat(user.totalInvestment).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{formatDate(user.joinedAt)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a
                            href={user.treeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            View Tree
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleImpersonate(user.userId)}
                              className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md hover:bg-indigo-100"
                            >
                              Login
                            </button>
                            <button
                              onClick={() => handleDeleteClick(user.userId, user.name)}
                              disabled={deletingUserId === user.userId || user.userId === 'CROWN-000000'}
                              className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingUserId === user.userId ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} users
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Delete User
              </h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteConfirm.userName}</span> ({deleteConfirm.userId})?
              </p>
              <p className="text-xs text-red-600 text-center mb-6 bg-red-50 p-3 rounded">
                ⚠️ This action cannot be undone. This will permanently delete the user and all related data including investments, wallets, transactions, withdrawals, vouchers, tickets, and binary tree entries.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deletingUserId === deleteConfirm.userId}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deletingUserId === deleteConfirm.userId}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {deletingUserId === deleteConfirm.userId ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

