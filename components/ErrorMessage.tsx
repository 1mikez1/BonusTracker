'use client';

interface ErrorMessageProps {
  error: Error | string | null;
  onRetry?: () => void;
  title?: string;
}

export function ErrorMessage({ error, onRetry, title = 'Error loading data' }: ErrorMessageProps) {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message || 'An unknown error occurred';

  return (
    <div
      style={{
        padding: '1.5rem',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#991b1b'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
      </div>
      <p style={{ margin: 0, marginBottom: onRetry ? '1rem' : 0, fontSize: '0.9rem' }}>{errorMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 1rem',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

