'use client';

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = 'No data available',
  message = 'There are no records to display.',
  action
}: EmptyStateProps) {
  return (
    <div
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        color: '#64748b'
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
      <h3 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#475569' }}>
        {title}
      </h3>
      <p style={{ margin: 0, marginBottom: action ? '1.5rem' : 0, fontSize: '0.9rem' }}>{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '0.5rem 1.5rem',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

