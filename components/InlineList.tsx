'use client';

interface InlineListProps {
  items: string[];
}

export function InlineList({ items }: InlineListProps) {
  if (!items.length) {
    return <span style={{ color: '#94a3b8' }}>—</span>;
  }
  return <div className="tag-cloud">{items.map((item) => <span key={item}>{item}</span>)}</div>;
}
