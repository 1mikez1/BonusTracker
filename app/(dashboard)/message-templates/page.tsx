'use client';

import { useMemo, useState } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { DataTable } from '@/components/DataTable';
import { FiltersBar } from '@/components/FiltersBar';
import { useSupabaseData } from '@/lib/useSupabaseData';

export default function MessageTemplatesPage() {
  const { data: templates } = useSupabaseData({ table: 'message_templates', order: { column: 'name', ascending: true } });
  const { data: apps } = useSupabaseData({ table: 'apps' });

  const [languageFilter, setLanguageFilter] = useState('all');
  const [appFilter, setAppFilter] = useState('all');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    return templates.map((template) => {
      const app = apps.find((item) => item.id === template.app_id ?? '');
      return {
        ...template,
        appName: app?.name ?? 'Generic'
      };
    });
  }, [templates, apps]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (languageFilter !== 'all' && row.language !== languageFilter) {
        return false;
      }
      if (appFilter !== 'all' && row.app_id !== appFilter) {
        return false;
      }
      if (search) {
        const haystack = `${row.name} ${row.content}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [rows, languageFilter, appFilter, search]);

  const languages = Array.from(new Set(templates.map((template) => template.language).filter(Boolean))) as string[];

  return (
    <div>
      <SectionHeader
        title="Message templates"
        description="Copy/paste guides covering registration, KYC and deposit steps."
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
        <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}>
          <option value="all">All languages</option>
          {languages.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
        <input placeholder="Search text" value={search} onChange={(event) => setSearch(event.target.value)} />
      </FiltersBar>
      <DataTable
        data={filteredRows}
        columns={[
          { key: 'name', header: 'Template' },
          { key: 'appName', header: 'App' },
          { key: 'step', header: 'Step', render: (row) => row.step ?? '—' },
          { key: 'language', header: 'Language', render: (row) => row.language ?? '—' },
          {
            key: 'content',
            header: 'Content',
            render: (row) => <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{row.content}</pre>
          }
        ]}
      />
    </div>
  );
}
