import React from 'react';
import type { PartnerPaymentHistory } from '@/types/partners';

interface PartnerPaymentsTableProps {
  payments: PartnerPaymentHistory[];
  onDelete?: (paymentId: string) => void;
}

export function PartnerPaymentsTable({ payments, onDelete }: PartnerPaymentsTableProps) {
  if (!payments.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No payments recorded.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-left font-medium">Note</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <tr key={payment.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-900">
                {new Date(payment.paidAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-slate-600">{payment.note ?? '—'}</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                €{Number(payment.amount).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  className="text-sm font-medium text-red-600 hover:text-red-500"
                  onClick={() => onDelete?.(payment.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

