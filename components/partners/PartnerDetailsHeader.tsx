import React from 'react';
import type { ClientPartner, PartnerBalance } from '@/types/partners';

interface PartnerDetailsHeaderProps {
  partner: ClientPartner;
  balance: PartnerBalance;
  onEdit?: () => void;
  onAddPayment?: () => void;
}

export function PartnerDetailsHeader({ partner, balance, onEdit, onAddPayment }: PartnerDetailsHeaderProps) {
  const stats = [
    { label: 'Total Profit', value: `€${balance.totalProfit.toFixed(2)}` },
    { label: 'Partner Share', value: `€${balance.partnerShare.toFixed(2)}` },
    { label: 'Owner Share', value: `€${balance.ownerShare.toFixed(2)}` },
    { label: 'Paid', value: `€${balance.totalPaid.toFixed(2)}` },
    {
      label: 'Balance',
      value: `€${balance.balance.toFixed(2)}`,
      emphasis: true
    }
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">Partner</p>
          <h1 className="text-2xl font-bold text-slate-900">{partner.name}</h1>
          {partner.contact_info && <p className="text-sm text-slate-500">{partner.contact_info}</p>}
          {partner.notes && <p className="mt-2 text-sm text-slate-600">{partner.notes}</p>}
          <p className="mt-3 text-sm text-slate-500">
            Default split: {Math.round(partner.default_split_partner * 100)}% partner /{' '}
            {Math.round(partner.default_split_owner * 100)}% us
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onEdit}
          >
            Edit Partner
          </button>
          <button
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            onClick={onAddPayment}
          >
            Add Payment
          </button>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border px-4 py-3 ${
              stat.emphasis ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p
              className={`mt-1 text-lg font-semibold ${
                stat.emphasis
                  ? balance.balance > 0
                    ? 'text-red-600'
                    : balance.balance < 0
                      ? 'text-emerald-700'
                      : 'text-slate-900'
                  : 'text-slate-900'
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

