'use client';

interface MetricCardProps {
  title: string;
  value: string;
  caption?: string;
}

export function MetricCard({ title, value, caption }: MetricCardProps) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <strong>{value}</strong>
      {caption ? <span style={{ color: '#475569', fontSize: '0.9rem' }}>{caption}</span> : null}
    </div>
  );
}
