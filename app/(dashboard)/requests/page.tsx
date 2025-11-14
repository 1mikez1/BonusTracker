'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';
import { useSupabaseData } from '@/lib/useSupabaseData';

export default function RequestsPage() {
  const { data: requests } = useSupabaseData({ table: 'requests', order: { column: 'created_at', ascending: false } });

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(() => {
    return requests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }
      if (search) {
        const haystack = `${request.name} ${request.contact ?? ''} ${request.requested_apps_raw ?? ''}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  return (
    <div>
      <SectionHeader
        title="Requests"
        description="Inbox synced from Google Form submissions ready for conversion into client records."
      />
      <FiltersBar>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </select>
        <input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </FiltersBar>
      <DataTable
        data={filteredRows}
        columns={[
          { key: 'name', header: 'Requester' },
          { key: 'contact', header: 'Contact', render: (row) => row.contact ?? '—' },
          { key: 'requested_apps_raw', header: 'Requested apps', render: (row) => row.requested_apps_raw ?? '—' },
          { key: 'status', header: 'Status' },
          {
            key: 'created_at',
            header: 'Received',
            render: (row) => new Date(row.created_at).toLocaleString()
          },
          {
            key: 'notes',
            header: 'Notes',
            render: (row) => row.notes ?? '—'
          }
        ]}
      />
    </div>
  );
}
