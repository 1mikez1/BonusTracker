'use client';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export function LoadingSpinner({ size = 'medium', message }: LoadingSpinnerProps) {
  const sizeValue = size === 'small' ? '16px' : size === 'medium' ? '32px' : '48px';

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-spinner {
          animation: spin 1s linear infinite;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1rem' }}>
        <div
          className="loading-spinner"
          style={{
            width: sizeValue,
            height: sizeValue,
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #2563eb',
            borderRadius: '50%'
          }}
        />
        {message && <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{message}</p>}
      </div>
    </>
  );
}

