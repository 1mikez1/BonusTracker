import React from 'react';
import type { PartnerSummary } from '@/types/partners';

interface PartnerCardProps {
  summary: PartnerSummary;
  onSelect?: (partnerId: string) => void;
}

export function PartnerCard({ summary, onSelect }: PartnerCardProps) {
  const balanceColor = summary.balance > 0 ? 'text-red-600' : summary.balance < 0 ? 'text-green-600' : 'text-slate-600';
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md cursor-pointer"
      onClick={() => onSelect?.(summary.partner.id)}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{summary.partner.name}</h3>
          {summary.partner.contact_info && (
            <p className="text-sm text-slate-500">{summary.partner.contact_info}</p>
          )}
        </div>
        <div className="text-sm text-slate-500">
          Split {Math.round(summary.partner.default_split_partner * 100)}% /{' '}
          {Math.round(summary.partner.default_split_owner * 100)}%
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Clients</p>
          <p className="text-lg font-semibold text-slate-900">{summary.clientsCount}</p>
        </div>
        <div>
          <p className="text-slate-500">Total Profit</p>
          <p className="text-lg font-semibold text-slate-900">€{summary.totalProfit.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-500">Partner Share</p>
          <p className="text-lg font-semibold text-slate-900">€{summary.partnerShare.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-500">Paid</p>
          <p className="text-lg font-semibold text-slate-900">€{summary.totalPaid.toFixed(2)}</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <p className="text-slate-500">Balance due</p>
        <p className={`text-lg font-semibold ${balanceColor}`}>€{summary.balance.toFixed(2)}</p>
      </div>
    </div>
  );
}

