'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import UserLayout from '@/components/UserLayout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requireUser>
      <UserLayout>
        {children}
      </UserLayout>
    </ProtectedRoute>
  );
}

