'use client';

import { useMemo, useState } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';

export default function ReferralLinksPage() {
  const { data: referralLinks } = useSupabaseData({ table: 'referral_links' });
  const { data: apps } = useSupabaseData({ table: 'apps' });
  const { data: clients } = useSupabaseData({ table: 'clients' });

  const [appFilter, setAppFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const rows = useMemo(() => {
    return referralLinks.map((link) => {
      const app = apps.find((item) => item.id === link.app_id);
      const owner = clients.find((client) => client.id === link.owner_client_id ?? '');
      const remaining = link.max_uses ? Math.max(link.max_uses - link.current_uses, 0) : undefined;
      return {
        ...link,
        appName: app?.name ?? 'Unknown app',
        ownerName: owner ? `${owner.name} ${owner.surname ?? ''}`.trim() : 'Internal',
        remaining
      };
    });
  }, [referralLinks, apps, clients]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (appFilter !== 'all' && row.app_id !== appFilter) {
        return false;
      }
      if (ownerFilter === 'internal' && row.owner_client_id) {
        return false;
      }
      if (ownerFilter === 'external' && !row.owner_client_id) {
        return false;
      }
      if (statusFilter === 'available' && !row.is_active) {
        return false;
      }
      if (statusFilter === 'inactive' && row.is_active) {
        return false;
      }
      return true;
    });
  }, [rows, appFilter, ownerFilter, statusFilter]);

  return (
    <div>
      <SectionHeader
        title="Referral links"
        description="Track referral URL usage, owners, and safe remaining capacity."
      />
      <FiltersBar>
        <select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}>
          <option value="all">All apps</option>
          {apps.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
        <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
          <option value="all">All owners</option>
          <option value="internal">Owned by operations</option>
          <option value="external">Owned by clients</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="available">Available</option>
          <option value="inactive">Inactive</option>
        </select>
      </FiltersBar>
      <DataTable
        data={filteredRows}
        columns={[
          { key: 'appName', header: 'App' },
          {
            key: 'url',
            header: 'Referral link',
            render: (row) => (
              <a href={row.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                {row.url}
              </a>
            )
          },
          { key: 'ownerName', header: 'Owner' },
          {
            key: 'current_uses',
            header: 'Usage',
            render: (row) => (
              <div>
                <strong>{row.current_uses}</strong>
                {row.max_uses ? (
                  <div style={{ color: row.remaining && row.remaining < 3 ? '#b91c1c' : '#475569' }}>
                    {row.remaining} remaining
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8' }}>Unlimited</div>
                )}
              </div>
            )
          },
          {
            key: 'is_active',
            header: 'Status',
            render: (row) => (row.is_active ? <span className="badge success">Available</span> : <span className="badge warning">Disabled</span>)
          },
          { key: 'notes', header: 'Notes', render: (row) => row.notes ?? '—' }
        ]}
      />
    </div>
  );
}
