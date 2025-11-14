'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';
import { useSupabaseData } from '@/lib/useSupabaseData';

export default function PaymentLinksPage() {
  const { data: paymentLinks } = useSupabaseData({ table: 'payment_links', order: { column: 'created_at', ascending: false } });
  const { data: clients } = useSupabaseData({ table: 'clients' });
  const { data: apps } = useSupabaseData({ table: 'apps' });

  const [usedFilter, setUsedFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');

  const rows = useMemo(() => {
    return paymentLinks.map((link) => {
      const client = clients.find((item) => item.id === link.client_id ?? '');
      const app = apps.find((item) => item.id === link.app_id ?? '');
      return {
        ...link,
        clientName: client ? `${client.name} ${client.surname ?? ''}`.trim() : '—',
        appName: app?.name ?? '—'
      };
    });
  }, [paymentLinks, clients, apps]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (usedFilter === 'used' && !row.used) {
        return false;
      }
      if (usedFilter === 'unused' && row.used) {
        return false;
      }
      if (providerFilter !== 'all' && row.provider !== providerFilter) {
        return false;
      }
      return true;
    });
  }, [rows, usedFilter, providerFilter]);

  const providers = Array.from(new Set(paymentLinks.map((link) => link.provider))).sort();

  return (
    <div>
      <SectionHeader
        title="Payment links"
        description="Manage SumUp, Amazon and other payment URLs used to move funds."
      />
      <FiltersBar>
        <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
          <option value="all">All providers</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
        <select value={usedFilter} onChange={(event) => setUsedFilter(event.target.value)}>
          <option value="all">Used & unused</option>
          <option value="used">Used only</option>
          <option value="unused">Unused only</option>
        </select>
      </FiltersBar>
      <DataTable
        data={filteredRows}
        columns={[
          { key: 'provider', header: 'Provider' },
          {
            key: 'url',
            header: 'URL',
            render: (row) => (
              <a href={row.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                {row.url}
              </a>
            )
          },
          { key: 'amount', header: 'Amount', render: (row) => `€${Number(row.amount ?? 0).toFixed(2)}` },
          { key: 'purpose', header: 'Purpose', render: (row) => row.purpose ?? '—' },
          { key: 'clientName', header: 'Client' },
          { key: 'appName', header: 'App' },
          { key: 'used', header: 'Used', render: (row) => (row.used ? 'Yes' : 'No') },
          { key: 'created_at', header: 'Created', render: (row) => new Date(row.created_at).toLocaleString() }
        ]}
      />
    </div>
  );
}
