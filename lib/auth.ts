'use client';

import { getSupabaseClient } from './supabaseClient';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const client = getSupabaseClient();

  useEffect(() => {
    if (!client) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Get initial session
    client.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      // If session check fails, assume not authenticated
      setUser(null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  const signOut = async () => {
    if (!client) return;
    await client.auth.signOut();
  };

  return { user, loading, signOut };
}

export async function requireAuth(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const {
    data: { session },
    error
  } = await client.auth.getSession();

  if (error || !session?.user) {
    return null;
  }

  return session.user;
}

