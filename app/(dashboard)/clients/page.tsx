'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { MetricCard } from '@/components/MetricCard';

interface ClientRow {
  id: string;
  name: string;
  surname: string | null;
  contact: string | null;
  email: string | null;
  trusted: boolean;
  tier_id: string | null;
  invited_by_client_id: string | null;
  notes: string | null;
  created_at: string;
  tier_name?: string;
  total_apps: number;
  total_profit_us: number;
  statuses: Record<string, number>;
}

export default function ClientsPage() {
  const { data: clients, isDemo } = useSupabaseData({ table: 'clients', order: { column: 'created_at', ascending: false } });
  const { data: tiers } = useSupabaseData({ table: 'tiers', order: { column: 'priority', ascending: true } });
  const { data: clientApps } = useSupabaseData({ table: 'client_apps' });

  const [tierFilter, setTierFilter] = useState<string>('all');
  const [trustedFilter, setTrustedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const rows = useMemo<ClientRow[]>(() => {
    return clients.map((client) => {
      const apps = clientApps.filter((item) => item.client_id === client.id);
      const totalProfit = apps.reduce((sum, app) => sum + Number(app.profit_us ?? 0), 0);
      const statuses = apps.reduce<Record<string, number>>((acc, app) => {
        acc[app.status] = (acc[app.status] ?? 0) + 1;
        return acc;
      }, {});
      return {
        ...client,
        tier_name: tiers.find((tier) => tier.id === client.tier_id)?.name,
        total_apps: apps.length,
        total_profit_us: totalProfit,
        statuses
      };
    });
  }, [clients, clientApps, tiers]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (tierFilter !== 'all' && row.tier_id !== tierFilter) {
        return false;
      }
      if (trustedFilter !== 'all') {
        const shouldBeTrusted = trustedFilter === 'trusted';
        if (row.trusted !== shouldBeTrusted) {
          return false;
        }
      }
      if (statusFilter !== 'all') {
        if (!row.statuses[statusFilter]) {
          return false;
        }
      }
      if (search) {
        const text = `${row.name} ${row.surname ?? ''} ${row.contact ?? ''} ${row.email ?? ''}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [rows, tierFilter, trustedFilter, statusFilter, search]);

  const metrics = useMemo(() => {
    const totalProfit = filteredRows.reduce((sum, row) => sum + row.total_profit_us, 0);
    const trustedCount = filteredRows.filter((row) => row.trusted).length;
    return [
      { title: 'Clients', value: filteredRows.length.toString(), caption: 'Filtered subset' },
      { title: 'Trusted clients', value: trustedCount.toString(), caption: 'Marked as high confidence' },
      { title: 'Pipeline apps', value: clientApps.length.toString(), caption: 'All active app workflows' },
      { title: 'Total internal profit', value: `€${totalProfit.toFixed(2)}`, caption: 'Aggregated from client apps' }
    ];
  }, [filteredRows, clientApps]);

  return (
    <div>
      <SectionHeader
        title="Clients"
        description={
          isDemo
            ? 'Showing interactive demo data. Provide Supabase environment variables to load production records.'
            : 'List of all clients with aggregated activity and profitability.'
        }
        actions={<Link href="/requests" className="primary">Convert request</Link>}
      />
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} title={metric.title} value={metric.value} caption={metric.caption} />
        ))}
      </div>
      <FiltersBar>
        <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
          <option value="all">All tiers</option>
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.name}
            </option>
          ))}
        </select>
        <select value={trustedFilter} onChange={(event) => setTrustedFilter(event.target.value)}>
          <option value="all">Trusted & non-trusted</option>
          <option value="trusted">Trusted only</option>
          <option value="untrusted">Non-trusted only</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="requested">Requested</option>
          <option value="registered">Registered</option>
          <option value="deposited">Deposited</option>
          <option value="waiting_bonus">Waiting bonus</option>
          <option value="completed">Completed</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          placeholder="Search name/contact"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </FiltersBar>
      <DataTable
        data={filteredRows}
        columns={[
          {
            key: 'name',
            header: 'Client',
            render: (row) => (
              <div>
                <Link href={`/clients/${row.id}`} style={{ fontWeight: 600 }}>
                  {row.name} {row.surname ?? ''}
                </Link>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{row.contact ?? '—'}</div>
              </div>
            )
          },
          {
            key: 'tier_name',
            header: 'Tier',
            render: (row) => row.tier_name ?? '—'
          },
          {
            key: 'trusted',
            header: 'Trust',
            render: (row) => (row.trusted ? <span className="badge success">Trusted</span> : '—')
          },
          {
            key: 'total_apps',
            header: 'Apps',
            render: (row) => (
              <div>
                <strong>{row.total_apps}</strong>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  {Object.entries(row.statuses).map(([status, count]) => (
                    <span key={status} className="badge info">
                      {status.replace(/_/g, ' ')} · {count}
                    </span>
                  ))}
                </div>
              </div>
            )
          },
          {
            key: 'total_profit_us',
            header: 'Internal profit',
            render: (row) => `€${row.total_profit_us.toFixed(2)}`
          },
          {
            key: 'created_at',
            header: 'Created',
            render: (row) => new Date(row.created_at).toLocaleDateString()
          }
        ]}
      />
    </div>
  );
}
