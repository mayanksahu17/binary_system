'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

function CancelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100">
            <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
        <p className="text-gray-600 mb-6">
          Your payment was cancelled. No charges have been made to your account.
        </p>

        {orderId && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Order ID:</p>
            <p className="text-sm font-mono text-gray-900">{orderId}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => router.push('/plans')}
            className="block w-full px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-semibold transition-colors"
          >
            Back to Plans
          </button>
          <Link
            href="/dashboard"
            className="block w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-semibold transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  );
}

export default function InvestCancelPage() {
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
        <CancelContent />
      </Suspense>
    </ProtectedRoute>
  );
}

