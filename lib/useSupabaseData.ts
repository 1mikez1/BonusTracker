'use client';

import useSWR from 'swr';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { demoData } from '@/lib/demoData';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type TableName = keyof Database['public']['Tables'];

type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row'];

interface QueryOptions<T extends TableName> {
  table: T;
  select?: string;
  match?: Partial<TableRow<T>>;
  order?: { column: keyof TableRow<T>; ascending?: boolean };
}

async function fetchTable<T extends TableName>(
  client: SupabaseClient<Database>,
  options: QueryOptions<T>
) {
  const { table, select = '*', match, order } = options;
  let query = client.from(table).select(select) as any;
  if (match) {
    query = query.match(match);
  }
  if (order) {
    query = query.order(order.column as string, { ascending: order.ascending ?? true });
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data as Array<TableRow<T>>;
}

function getDemoData<T extends TableName>(table: T): Array<TableRow<T>> {
  return (demoData as Record<string, unknown>)[table] as Array<TableRow<T>>;
}

export function useSupabaseData<T extends TableName>(options: QueryOptions<T>) {
  const client = getSupabaseClient();
  const key = client
    ? `${options.table}|${options.select ?? '*'}|${options.match ? JSON.stringify(options.match) : ''}|${
        options.order ? `${String(options.order.column)}:${options.order.ascending ?? true}` : ''
      }`
    : null;

  const { data, error, isLoading } = useSWR(
    key,
    async () => fetchTable(client as SupabaseClient<Database>, options),
    {
      revalidateOnFocus: false
    }
  );

  if (!client) {
    return {
      data: getDemoData(options.table),
      isLoading: false,
      error: undefined,
      isDemo: true
    } as const;
  }

  return {
    data: data ?? [],
    isLoading,
    error,
    isDemo: false
  } as const;
}
