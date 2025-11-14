'use client';

import type { ReactNode } from 'react';

interface FiltersBarProps {
  children: ReactNode;
}

export function FiltersBar({ children }: FiltersBarProps) {
  return <div className="filters">{children}</div>;
}
