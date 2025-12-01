import React, { useState } from 'react';

interface PartnerPaymentFormProps {
  onSubmit: (amount: number, note: string) => Promise<void>;
  onCancel?: () => void;
}

export function PartnerPaymentForm({ onSubmit, onCancel }: PartnerPaymentFormProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(parsed, note);
      setAmount('');
      setNote('');
      onCancel?.();
    } catch (err) {
      console.error(err);
      setError('Failed to save payment. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-slate-700">Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Note (optional)</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Payment'}
        </button>
      </div>
    </form>
  );
}

