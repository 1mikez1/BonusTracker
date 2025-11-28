'use client';

import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function SectionHeader({ title, description, actions }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <div>
        <h1>{title}</h1>
        {description ? <p style={{ color: '#64748b', marginTop: '0.35rem' }}>{description}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}
