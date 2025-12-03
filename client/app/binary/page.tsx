'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

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

export default function BinaryPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [binaryTree, setBinaryTree] = useState<BinaryTreeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBinaryTree();
  }, []);

  const fetchBinaryTree = async () => {
    try {
      setLoading(true);
      const response = await api.getUserBinaryTree();
      if (response.data) {
        setBinaryTree(response.data.binaryTree);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load binary tree information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requireUser>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading binary tree information...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!binaryTree) {
    return (
      <ProtectedRoute requireUser>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg">Binary tree information not found</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const minBusiness = Math.min(binaryTree.leftBusiness, binaryTree.rightBusiness);
  const binaryBonus = minBusiness * 0.1;
  const totalDownlines = binaryTree.leftDownlines + binaryTree.rightDownlines;

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
                <h1 className="text-2xl font-bold text-gray-900">Binary / Genealogy Information</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/my-tree')}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50"
                >
                  View My Tree
                </button>
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

          <div className="px-4 py-6 sm:px-0">
            {/* Business Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <p className="text-sm opacity-90 mb-2">Left Business</p>
                <p className="text-3xl font-bold">${binaryTree.leftBusiness.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                <p className="text-sm opacity-90 mb-2">Right Business</p>
                <p className="text-3xl font-bold">${binaryTree.rightBusiness.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <p className="text-sm opacity-90 mb-2">Binary Bonus</p>
                <p className="text-3xl font-bold">${binaryBonus.toFixed(2)}</p>
                <p className="text-xs opacity-75 mt-1">10% of minimum</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
                <p className="text-sm opacity-90 mb-2">Total Downlines</p>
                <p className="text-3xl font-bold">{totalDownlines}</p>
              </div>
            </div>

            {/* Detailed Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Business Details */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Business Details</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Left Business</p>
                      <p className="text-sm text-gray-500">Total business from left leg</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">${binaryTree.leftBusiness.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Right Business</p>
                      <p className="text-sm text-gray-500">Total business from right leg</p>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">${binaryTree.rightBusiness.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Minimum Business</p>
                      <p className="text-sm text-gray-500">Used for binary bonus calculation</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">${minBusiness.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Binary Bonus (10%)</p>
                      <p className="text-sm text-gray-500">Earned from matching business</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-600">${binaryBonus.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Carry Forward & Downlines */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Carry Forward & Downlines</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Left Carry</p>
                      <p className="text-sm text-gray-500">Excess from left leg</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-600">${binaryTree.leftCarry.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Right Carry</p>
                      <p className="text-sm text-gray-500">Excess from right leg</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-600">${binaryTree.rightCarry.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Left Downlines</p>
                      <p className="text-sm text-gray-500">Users in left leg</p>
                    </div>
                    <p className="text-2xl font-bold text-indigo-600">{binaryTree.leftDownlines}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-700">Right Downlines</p>
                      <p className="text-sm text-gray-500">Users in right leg</p>
                    </div>
                    <p className="text-2xl font-bold text-indigo-600">{binaryTree.rightDownlines}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tree Connections */}
            {(binaryTree.parent || binaryTree.leftChild || binaryTree.rightChild) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Tree Connections</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {binaryTree.parent && (
                    <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                      <p className="text-xs text-gray-500 mb-1">Parent (Sponsor)</p>
                      <p className="font-bold text-indigo-700 text-lg">{binaryTree.parent.name}</p>
                      <p className="text-sm text-gray-600">{binaryTree.parent.userId}</p>
                    </div>
                  )}
                  {binaryTree.leftChild && (
                    <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <p className="text-xs text-gray-500 mb-1">Left Child</p>
                      <p className="font-bold text-blue-700 text-lg">{binaryTree.leftChild.name}</p>
                      <p className="text-sm text-gray-600">{binaryTree.leftChild.userId}</p>
                    </div>
                  )}
                  {binaryTree.rightChild && (
                    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                      <p className="text-xs text-gray-500 mb-1">Right Child</p>
                      <p className="font-bold text-purple-700 text-lg">{binaryTree.rightChild.name}</p>
                      <p className="text-sm text-gray-600">{binaryTree.rightChild.userId}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

