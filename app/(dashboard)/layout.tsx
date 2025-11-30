'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EnvWarning } from '@/components/EnvWarning';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      // Check if Supabase is configured
      const client = getSupabaseClient();
      if (!client) {
        // Supabase not configured - allow access but show warning
        console.warn('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
        return;
      }
      // Redirect to login if not authenticated
      router.push('/login?redirect=' + encodeURIComponent(pathname));
    }
  }, [user, loading, router, pathname]);

  // Show loading while checking auth - don't show sidebar or content
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <LoadingSpinner message="Checking authentication..." />
      </div>
    );
  }

  // Don't render dashboard if not authenticated (redirect will happen)
  // Exception: if Supabase is not configured, allow access in demo mode
  const client = getSupabaseClient();
  const showEnvWarning = !client;
  
  // If not authenticated and Supabase is configured, show loading while redirecting
  if (!user && client) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc'
      }}>
        <LoadingSpinner message="Redirecting to login..." />
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {showEnvWarning && <EnvWarning />}
        {children}
      </main>
    </div>
  );
}
