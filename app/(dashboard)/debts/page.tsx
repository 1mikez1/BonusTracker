'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { StatusBadge } from '@/components/StatusBadge';

export default function DebtsPage() {
  const { data: debts } = useSupabaseData({ table: 'referral_link_debts' });
  const { data: clients } = useSupabaseData({ table: 'clients' });
  const { data: referralLinks } = useSupabaseData({ table: 'referral_links' });

  const [statusFilter, setStatusFilter] = useState('all');
  const [creditorFilter, setCreditorFilter] = useState('all');

  const rows = useMemo(() => {
    return debts.map((debt) => {
      const creditor = clients.find((client) => client.id === debt.creditor_client_id);
      const debtor = clients.find((client) => client.id === debt.debtor_client_id ?? '');
      const link = referralLinks.find((item) => item.id === debt.referral_link_id);
      return {
        ...debt,
        creditorName: creditor ? `${creditor.name} ${creditor.surname ?? ''}`.trim() : debt.creditor_client_id,
        debtorName: debtor ? `${debtor.name} ${debtor.surname ?? ''}`.trim() : '—',
        linkUrl: link?.url ?? '—'
      };
    });
  }, [debts, clients, referralLinks]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }
      if (creditorFilter !== 'all' && row.creditor_client_id !== creditorFilter) {
        return false;
      }
      return true;
    });
  }, [rows, statusFilter, creditorFilter]);

  return (
    <div>
      <SectionHeader
        title="Referral link debts"
        description="Monitor loans and fronted deposits linked to referral usage."
      />
      <FiltersBar>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="settled">Settled</option>
        </select>
        <select value={creditorFilter} onChange={(event) => setCreditorFilter(event.target.value)}>
          <option value="all">All creditors</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} {client.surname ?? ''}
            </option>
          ))}
        </select>
      </FiltersBar>
      <DataTable
        data={filteredRows}
        columns={[
          { key: 'creditorName', header: 'Creditor' },
          { key: 'debtorName', header: 'Debtor' },
          { key: 'linkUrl', header: 'Referral link' },
          { key: 'amount', header: 'Amount', render: (row) => `€${Number(row.amount).toFixed(2)}` },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} />
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
