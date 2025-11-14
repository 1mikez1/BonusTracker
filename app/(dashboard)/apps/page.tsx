'use client';

import { useMemo, useState } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { SectionHeader } from '@/components/SectionHeader';
import { MetricCard } from '@/components/MetricCard';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

export default function AppsPage() {
  const { data: apps } = useSupabaseData({ table: 'apps', order: { column: 'name', ascending: true } });
  const { data: promotions } = useSupabaseData({ table: 'promotions' });
  const { data: clientApps } = useSupabaseData({ table: 'client_apps' });
  const { data: referralLinks } = useSupabaseData({ table: 'referral_links' });

  const [typeFilter, setTypeFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  const rows = useMemo(() => {
    return apps.map((app) => {
      const appPromotions = promotions.filter((promo) => promo.app_id === app.id);
      const appClientApps = clientApps.filter((item) => item.app_id === app.id);
      const appReferralLinks = referralLinks.filter((link) => link.app_id === app.id);
      const totalProfit = appClientApps.reduce((sum, item) => sum + Number(item.profit_us ?? 0), 0);
      return {
        ...app,
        promotions: appPromotions,
        clientApps: appClientApps,
        referralLinks: appReferralLinks,
        totalProfit
      };
    });
  }, [apps, promotions, clientApps, referralLinks]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (typeFilter !== 'all' && row.app_type !== typeFilter) {
        return false;
      }
      if (activeFilter === 'active' && !row.is_active) {
        return false;
      }
      if (activeFilter === 'inactive' && row.is_active) {
        return false;
      }
      return true;
    });
  }, [rows, typeFilter, activeFilter]);

  const metrics = useMemo(() => {
    const totalProfit = filteredRows.reduce((sum, row) => sum + row.totalProfit, 0);
    const totalClients = filteredRows.reduce((sum, row) => sum + row.clientApps.length, 0);
    return [
      { title: 'Apps', value: filteredRows.length.toString(), caption: 'Filtered by current view' },
      { title: 'Client workflows', value: totalClients.toString(), caption: 'Active client-app combinations' },
      { title: 'Internal profit', value: `€${totalProfit.toFixed(2)}`, caption: 'Across filtered apps' },
      { title: 'Referral links', value: referralLinks.length.toString(), caption: 'Total across ecosystem' }
    ];
  }, [filteredRows, referralLinks]);

  const uniqueTypes = Array.from(new Set(apps.map((app) => app.app_type).filter(Boolean))) as string[];

  return (
    <div>
      <SectionHeader
        title="Apps & Promotions"
        description="Monitor every partner app with live promotions, referral inventory, and profitability."
      />
      <div className="card-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} title={metric.title} value={metric.value} caption={metric.caption} />
        ))}
      </div>
      <FiltersBar>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="all">All types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type ?? 'unknown'}>
              {type}
            </option>
          ))}
        </select>
        <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
          <option value="all">Active & inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </FiltersBar>
      <DataTable
        data={filteredRows}
        columns={[
          { key: 'name', header: 'App' },
          { key: 'app_type', header: 'Type', render: (row) => row.app_type ?? '—' },
          { key: 'country', header: 'Country', render: (row) => row.country ?? '—' },
          {
            key: 'is_active',
            header: 'Active',
            render: (row) => (row.is_active ? <span className="badge success">Active</span> : <span className="badge warning">Paused</span>)
          },
          {
            key: 'clientApps',
            header: 'Client workflows',
            render: (row) => (
              <div>
                <strong>{row.clientApps.length}</strong>
                <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {row.clientApps.slice(0, 3).map((entry) => (
                    <span key={entry.id} style={{ color: '#475569', fontSize: '0.85rem' }}>
                      {entry.client_id} → <StatusBadge status={entry.status} />
                    </span>
                  ))}
                  {row.clientApps.length > 3 ? <span style={{ color: '#94a3b8' }}>+ more</span> : null}
                </div>
              </div>
            )
          },
          {
            key: 'promotions',
            header: 'Promotions',
            render: (row) => (
              <div>
                {row.promotions.length ? (
                  <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    {row.promotions.map((promo) => (
                      <li key={promo.id} style={{ marginBottom: '0.35rem' }}>
                        <strong>{promo.name}</strong> · client €{Number(promo.client_reward).toFixed(2)} /
                        us €{Number(promo.our_reward).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ color: '#94a3b8' }}>No promotions</span>
                )}
              </div>
            )
          },
          {
            key: 'totalProfit',
            header: 'Internal profit',
            render: (row) => `€${row.totalProfit.toFixed(2)}`
          }
        ]}
      />
    </div>
  );
}
