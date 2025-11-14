'use client';

import { useMemo } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { StatusBadge } from '@/components/StatusBadge';

const STATUSES = ['requested', 'registered', 'deposited', 'waiting_bonus', 'completed', 'paid', 'cancelled'] as const;

type Status = (typeof STATUSES)[number];

export default function PipelinePage() {
  const { data: clientApps, isDemo } = useSupabaseData({ table: 'client_apps' });
  const { data: clients } = useSupabaseData({ table: 'clients' });
  const { data: apps } = useSupabaseData({ table: 'apps' });

  const columns = useMemo(() => {
    return STATUSES.map((status) => ({
      status,
      items: clientApps
        .filter((item) => item.status === status)
        .map((item) => {
          const client = clients.find((c) => c.id === item.client_id);
          const app = apps.find((a) => a.id === item.app_id);
          return {
            ...item,
            clientName: client ? `${client.name} ${client.surname ?? ''}`.trim() : item.client_id,
            appName: app?.name ?? item.app_id
          };
        })
    }));
  }, [clientApps, clients, apps]);

  return (
    <div>
      <SectionHeader
        title="Pipeline"
        description={
          isDemo
            ? 'Drag-and-drop interactions are disabled in demo mode. Connect Supabase to activate live workflow transitions.'
            : 'Drag and drop cards between stages to progress each client app.'
        }
      />
      <div className="status-columns">
        {columns.map((column) => (
          <div key={column.status} className="status-column">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ textTransform: 'capitalize' }}>{column.status.replace(/_/g, ' ')}</h3>
              <span className="badge info">{column.items.length}</span>
            </div>
            {column.items.map((item) => (
              <div key={item.id} className="status-card">
                <strong>{item.clientName}</strong>
                <span>{item.appName}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Deposit €{Number(item.deposit_amount ?? 0).toFixed(2)}</span>
                  <StatusBadge status={item.status} />
                </div>
                {item.notes ? <span>{item.notes}</span> : null}
              </div>
            ))}
            {!column.items.length ? <div className="empty-state">No items here.</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
