'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function ImpersonatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');

    if (!token || !userId) {
      setError('Invalid impersonation link');
      setLoading(false);
      return;
    }

    // Store the user token in sessionStorage (per-tab, so admin tab won't be affected)
    // Also store in localStorage with a special key to indicate it's an impersonation
    if (typeof window !== 'undefined') {
      // Store in sessionStorage for this tab only
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('impersonatedUserId', userId);
      sessionStorage.setItem('isImpersonating', 'true');
      
      // Also store in localStorage but with a flag
      localStorage.setItem('impersonatedToken', token);
      localStorage.setItem('impersonatedUserId', userId);
      
      // Refresh auth context by calling the API to verify the token
      // Then redirect to dashboard
      api.getUserProfile()
        .then(() => {
          // Successfully authenticated, redirect to dashboard
          router.push('/dashboard');
        })
        .catch((err) => {
          setError(err.message || 'Failed to authenticate as user');
          setLoading(false);
        });
    }
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Logging in as user...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
            <h2 className="text-xl font-bold mb-2">Authentication Failed</h2>
            <p>{error}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Close Tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

