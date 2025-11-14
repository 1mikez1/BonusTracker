'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';
import { useSupabaseData } from '@/lib/useSupabaseData';

export default function SlotsPage() {
  const { data: slots } = useSupabaseData({ table: 'slots', order: { column: 'rtp_percentage', ascending: false } });
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(() => {
    return slots.filter((slot) => {
      if (!search) {
        return true;
      }
      const haystack = `${slot.name} ${slot.provider ?? ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [slots, search]);

  return (
    <div>
      <SectionHeader
        title="Slots RTP"
        description="Pick the highest return-to-player slots for SISAL strategies."
      />
      <FiltersBar>
        <input placeholder="Search slot" value={search} onChange={(event) => setSearch(event.target.value)} />
      </FiltersBar>
      <DataTable
        data={filteredRows}
        columns={[
          { key: 'name', header: 'Slot' },
          { key: 'provider', header: 'Provider', render: (row) => row.provider ?? '—' },
          { key: 'rtp_percentage', header: 'RTP %', render: (row) => Number(row.rtp_percentage).toFixed(2) },
          { key: 'notes', header: 'Notes', render: (row) => row.notes ?? '—' }
        ]}
      />
    </div>
  );
}
