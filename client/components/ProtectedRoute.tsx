'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireUser?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireUser = false,
}: ProtectedRouteProps) {
  const { user, admin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (requireAdmin && !admin) {
      router.push('/login');
      return;
    }

    if (requireUser && !user) {
      router.push('/login');
      return;
    }

    // If no specific requirement, allow if either user or admin is logged in
    if (!requireAdmin && !requireUser && !user && !admin) {
      router.push('/login');
    }
  }, [user, admin, loading, requireAdmin, requireUser, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && !admin) {
    return null;
  }

  if (requireUser && !user) {
    return null;
  }

  if (!requireAdmin && !requireUser && !user && !admin) {
    return null;
  }

  return <>{children}</>;
}

