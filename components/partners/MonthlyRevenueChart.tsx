import React from 'react';
import type { MonthlyPoint } from '@/lib/partners';

interface MonthlyRevenueChartProps {
  data: MonthlyPoint[];
}

export function MonthlyRevenueChart({ data }: MonthlyRevenueChartProps) {
  const maxAmount = Math.max(...data.map((point) => point.amount), 0);
  if (!data.length || maxAmount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No revenue data yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Monthly Partner Revenue</h3>
      <div className="mt-4 flex items-end gap-3 overflow-x-auto">
        {data.map((point) => {
          const height = (point.amount / maxAmount) * 180 || 4;
          return (
            <div key={point.month} className="flex w-14 flex-col items-center text-xs text-slate-500">
              <div
                className="flex h-44 w-10 items-end rounded-lg bg-slate-100"
                title={`€${point.amount.toFixed(2)}`}
              >
                <div
                  className="w-full rounded-lg bg-emerald-500 transition-all"
                  style={{ height: `${height}px` }}
                />
              </div>
              <div className="mt-2 text-center text-[11px] font-medium text-slate-700">
                {point.month}
              </div>
              <div className="text-[11px] text-slate-500">€{point.amount.toFixed(0)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

