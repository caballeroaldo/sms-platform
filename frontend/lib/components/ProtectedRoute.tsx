'use client';

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'ADMIN' | 'USER';
}

function ProtectedRouteInner({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Check role if specified
  useEffect(() => {
    if (isAuthenticated && requiredRole && user?.role !== requiredRole) {
      // User doesn't have required role - redirect or show error
      // For now, redirect to dashboard
      router.push('/');
    }
  }, [isAuthenticated, user, requiredRole, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  // Check role authorization
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  return (
    <AuthProvider>
      <ProtectedRouteInner requiredRole={requiredRole}>
        {children}
      </ProtectedRouteInner>
    </AuthProvider>
  );
}

/**
 * Hook to check if user is authenticated
 * Use this in components that need to conditionally show/hide elements
 */
export function useRequireAuth(redirectTo = '/login') {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading };
}