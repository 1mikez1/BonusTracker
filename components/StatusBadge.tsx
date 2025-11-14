'use client';

const palette: Record<string, string> = {
  requested: 'info',
  registered: 'info',
  deposited: 'success',
  waiting_bonus: 'warning',
  completed: 'success',
  paid: 'success',
  cancelled: 'error',
  open: 'warning',
  settled: 'success',
  partial: 'info'
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = palette[status] ?? 'info';
  return <span className={`badge ${style}`}>{status.replace(/_/g, ' ')}</span>;
}
