'use client';

import { getSupabaseClient } from '@/lib/supabaseClient';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useState } from 'react';
import useSWR from 'swr';

type TableName = keyof Database['public']['Tables'];
type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row'];
type TableInsert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
type TableUpdate<T extends TableName> = Database['public']['Tables'][T]['Update'];

interface OptimisticUpdateOptions<T extends TableName> {
  optimisticData?: (currentData: TableRow<T>[]) => TableRow<T>[];
  rollbackOnError?: boolean;
  onSuccess?: (data: TableRow<T>) => void;
  onError?: (error: Error) => void;
}

export function useSupabaseMutations<T extends TableName>(
  table: T,
  swrKey?: string,
  mutateFn?: (data?: any, shouldRevalidate?: boolean) => Promise<any>
) {
  const client = getSupabaseClient();
  const [optimisticData, setOptimisticData] = useState<TableRow<T>[] | null>(null);

  const mutate = useCallback(
    async (
      updates: Partial<TableUpdate<T>>,
      id: string,
      options?: OptimisticUpdateOptions<T>
    ) => {
      if (!client) {
        throw new Error('Supabase client not initialized');
      }

      // Optimistic update
      if (options?.optimisticData && mutateFn) {
        const optimistic = options.optimisticData([]);
        await mutateFn(optimistic, false);
      }

      try {
        const { data, error } = await (client.from(table) as any).update(updates).eq('id', id).select().single();
        if (error) throw error;

        // Revalidate after success
        if (mutateFn) {
          await mutateFn();
        }

        if (options?.onSuccess) {
          options.onSuccess(data as TableRow<T>);
        }

        return data as TableRow<T>;
      } catch (error) {
        // Rollback on error
        if (options?.rollbackOnError !== false && mutateFn) {
          await mutateFn();
        }

        if (options?.onError) {
          options.onError(error as Error);
        }

        throw error;
      }
    },
    [client, table, mutateFn]
  );

  const insert = useCallback(
    async (row: TableInsert<T>, options?: OptimisticUpdateOptions<T>) => {
      if (!client) {
        throw new Error('Supabase client not initialized');
      }

      // Optimistic insert
      if (options?.optimisticData && mutateFn) {
        const optimistic = options.optimisticData([]);
        await mutateFn(optimistic, false);
      }

      try {
        const { data, error } = await (client.from(table) as any).insert(row).select().single();
        if (error) throw error;

        // Revalidate after success
        if (mutateFn) {
          await mutateFn();
        }

        if (options?.onSuccess) {
          options.onSuccess(data as TableRow<T>);
        }

        return data as TableRow<T>;
      } catch (error) {
        // Rollback on error
        if (options?.rollbackOnError !== false && mutateFn) {
          await mutateFn();
        }

        if (options?.onError) {
          options.onError(error as Error);
        }

        throw error;
      }
    },
    [client, table, mutateFn]
  );

  const remove = useCallback(
    async (id: string, options?: OptimisticUpdateOptions<T>) => {
      if (!client) {
        throw new Error('Supabase client not initialized');
      }

      // Optimistic delete
      if (options?.optimisticData && mutateFn) {
        const optimistic = options.optimisticData([]);
        await mutateFn(optimistic, false);
      }

      try {
        const { error } = await (client.from(table) as any).delete().eq('id', id);
        if (error) throw error;

        // Revalidate after success
        if (mutateFn) {
          await mutateFn();
        }

        if (options?.onSuccess) {
          options.onSuccess({} as TableRow<T>);
        }
      } catch (error) {
        // Rollback on error
        if (options?.rollbackOnError !== false && mutateFn) {
          await mutateFn();
        }

        if (options?.onError) {
          options.onError(error as Error);
        }

        throw error;
      }
    },
    [client, table, mutateFn]
  );

  return { mutate, insert, remove };
}

