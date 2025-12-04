'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

function LoginLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasRedirected.current || error || isRedirecting) return;

    const authenticateAndRedirect = async () => {
      const token = searchParams.get('token');
      const userId = searchParams.get('userId');

      if (!token || !userId) {
        setError('Invalid login link. Please check your email and try again.');
        setLoading(false);
        return;
      }

      // Store the user token in localStorage for normal login
      if (typeof window !== 'undefined') {
        try {
          // Clear any impersonation flags first
          sessionStorage.removeItem('isImpersonating');
          sessionStorage.removeItem('impersonatedUserId');
          localStorage.removeItem('impersonatedToken');
          localStorage.removeItem('impersonatedUserId');
          
          // Store in localStorage for persistent login
          localStorage.setItem('token', token);
          
          // Verify the token by calling the API first
          await api.getUserProfile();
          
          // Mark as redirected immediately to prevent re-execution
          hasRedirected.current = true;
          setIsRedirecting(true);
          setLoading(false);
          
          // Refresh the auth context in the background (don't wait for it)
          refreshAuth().catch(() => {
            // Ignore errors, the token is already stored
          });
          
          // Single redirect using replace - immediate redirect without delay
          router.replace('/dashboard');
        } catch (err: any) {
          // Clean up on error
          localStorage.removeItem('token');
          setError(err.message || 'Failed to login. The link may have expired. Please try logging in manually.');
          setLoading(false);
        }
      }
    };

    authenticateAndRedirect();
  }, [searchParams, refreshAuth, router, error, isRedirecting]);

  // Show nothing during redirect to prevent blinking
  if (isRedirecting) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Logging you in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
            <h2 className="text-xl font-bold mb-2">Login Failed</h2>
            <p className="mb-4">{error}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Go to Login Page
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function LoginLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginLinkContent />
    </Suspense>
  );
}

