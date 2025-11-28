'use client';

import Link from 'next/link';

export function EnvWarning() {
  return (
    <div
      style={{
        padding: '1rem',
        background: '#fef3c7',
        border: '1px solid #fde68a',
        borderRadius: '8px',
        marginBottom: '1rem',
        color: '#92400e'
      }}
    >
      <strong>⚠️ Supabase Not Configured</strong>
      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
        To use the full application, please set up your Supabase environment variables. See{' '}
        <Link href="/setup" style={{ color: '#b45309', textDecoration: 'underline' }}>
          SETUP_ENVIRONMENT.md
        </Link>{' '}
        for instructions.
      </p>
      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#a16207' }}>
        Currently running in demo mode with sample data.
      </p>
    </div>
  );
}

