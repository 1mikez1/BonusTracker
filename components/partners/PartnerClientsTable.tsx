import React from 'react';
import Link from 'next/link';
import type { PartnerClientBreakdown } from '@/types/partners';

interface PartnerClientsTableProps {
  rows: PartnerClientBreakdown[];
  onRemove?: (clientId: string) => void;
  assignments?: Array<{ id: string; client_id: string; notes: string | null }>;
}

export function PartnerClientsTable({ rows, onRemove, assignments }: PartnerClientsTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm font-medium text-slate-500">No clients assigned yet</p>
        <p className="mt-1 text-xs text-slate-400">Assign clients using the form on the right</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Client</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Total Profit</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Partner Share</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Owner Share</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Split</th>
            {onRemove && <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const assignment = assignments?.find(a => a.client_id === row.clientId);
            return (
              <tr key={row.clientId} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/clients/${row.clientId}`}
                      className="font-medium text-slate-900 hover:text-emerald-600 transition"
                    >
                      {row.clientName}
                    </Link>
                    {row.override && (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Custom Split
                      </span>
                    )}
                  </div>
                  {assignment?.notes && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-1">{assignment.notes}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-slate-900">
                    €{row.totalProfit.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-emerald-700">
                    €{row.partnerShare.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-slate-700">
                    €{row.ownerShare.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-slate-600">
                    {Math.round(row.splitPartner * 100)}% / {Math.round(row.splitOwner * 100)}%
                  </span>
                </td>
                {onRemove && (
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onRemove(row.clientId)}
                      className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline transition"
                      title="Remove client from partner"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

