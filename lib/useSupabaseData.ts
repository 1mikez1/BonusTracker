'use client';

import useSWR from 'swr';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { demoData } from '@/lib/demoData';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type TableName = keyof Database['public']['Tables'];

type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row'];

interface FilterOperator {
  eq?: any;
  neq?: any;
  gt?: any;
  gte?: any;
  lt?: any;
  lte?: any;
  ilike?: string;
  like?: string;
  in?: any[];
  is?: any;
}

interface QueryFilters {
  [key: string]: FilterOperator | any;
}

interface QueryOptions<T extends TableName> {
  table: T;
  select?: string;
  match?: Partial<TableRow<T>>;
  filters?: QueryFilters;
  order?: { column: keyof TableRow<T>; ascending?: boolean };
  limit?: number;
  offset?: number;
}

async function fetchTable<T extends TableName>(
  client: SupabaseClient<Database>,
  options: QueryOptions<T>
) {
  const { table, select = '*', match, filters, order, limit, offset } = options;
  let query = client.from(table).select(select) as any;
  
  // Apply match filters (simple equality)
  if (match) {
    Object.entries(match).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
  }
  
  // Apply advanced filters
  if (filters) {
    Object.entries(filters).forEach(([key, filterValue]) => {
      if (filterValue === undefined || filterValue === null) return;
      
      // Check if it's a filter operator object
      if (typeof filterValue === 'object' && !Array.isArray(filterValue) && filterValue !== null) {
        const operators = filterValue as FilterOperator;
        
        if (operators.eq !== undefined) query = query.eq(key, operators.eq);
        if (operators.neq !== undefined) query = query.neq(key, operators.neq);
        if (operators.gt !== undefined) query = query.gt(key, operators.gt);
        if (operators.gte !== undefined) query = query.gte(key, operators.gte);
        if (operators.lt !== undefined) query = query.lt(key, operators.lt);
        if (operators.lte !== undefined) query = query.lte(key, operators.lte);
        if (operators.ilike !== undefined) query = query.ilike(key, operators.ilike);
        if (operators.like !== undefined) query = query.like(key, operators.like);
        if (operators.in !== undefined) query = query.in(key, operators.in);
        if (operators.is !== undefined) query = query.is(key, operators.is);
      } else {
        // Simple equality fallback
        query = query.eq(key, filterValue);
      }
    });
  }
  
  if (order) {
    query = query.order(order.column as string, { ascending: order.ascending ?? true });
  }
  
  if (limit) {
    query = query.limit(limit);
  }
  
  if (offset !== undefined) {
    const end = offset + (limit || 100) - 1;
    query = query.range(offset, end);
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
        options.filters ? JSON.stringify(options.filters) : ''
      }|${options.order ? `${String(options.order.column)}:${options.order.ascending ?? true}` : ''}|${
        options.limit ?? 'none'
      }|${options.offset ?? 0}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => {
      if (!client) return [];
      return fetchTable(client as SupabaseClient<Database>, options);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 1000
    }
  );

  if (!client) {
    return {
      data: getDemoData(options.table),
      isLoading: false,
      error: undefined,
      isDemo: true,
      mutate: async () => {}
    } as const;
  }

  return {
    data: data ?? [],
    isLoading,
    error,
    isDemo: false,
    mutate
  } as const;
}
