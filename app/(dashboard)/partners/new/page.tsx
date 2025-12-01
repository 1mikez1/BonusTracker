'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SectionHeader } from '@/components/SectionHeader';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Toast } from '@/components/Toast';
import type { ClientPartner } from '@/types/partners';

export default function NewPartnerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = searchParams?.get('partnerId');
  const isEditing = Boolean(partnerId);

  const {
    data: existingPartner,
    isLoading,
    error,
    mutate: mutatePartner
  } = useSupabaseData({
    table: 'client_partners',
    match: partnerId ? { id: partnerId } : undefined
  });

  const { insert: insertPartner, mutate: updatePartner } = useSupabaseMutations('client_partners', undefined, mutatePartner);

  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [splitPartner, setSplitPartner] = useState('25');
  const [splitOwner, setSplitOwner] = useState('75');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  useEffect(() => {
    if (isEditing && existingPartner && existingPartner.length > 0) {
      const partner = existingPartner[0] as ClientPartner;
      setName(partner.name);
      setContactInfo(partner.contact_info ?? '');
      setSplitPartner((partner.default_split_partner * 100).toString());
      setSplitOwner((partner.default_split_owner * 100).toString());
      setNotes(partner.notes ?? '');
    }
  }, [isEditing, existingPartner]);

  // Auto-calculate owner share when partner share changes
  useEffect(() => {
    const partnerPct = Number(splitPartner) || 0;
    if (!isNaN(partnerPct) && partnerPct >= 0 && partnerPct <= 100) {
      setSplitOwner((100 - partnerPct).toString());
    }
  }, [splitPartner]);

  // Auto-calculate partner share when owner share changes
  useEffect(() => {
    const ownerPct = Number(splitOwner) || 0;
    if (!isNaN(ownerPct) && ownerPct >= 0 && ownerPct <= 100) {
      setSplitPartner((100 - ownerPct).toString());
    }
  }, [splitOwner]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }
    const partnerPct = Number(splitPartner) / 100;
    const ownerPct = Number(splitOwner) / 100;
    if (Number.isNaN(partnerPct) || Number.isNaN(ownerPct)) {
      setFormError('Split percentages must be numbers');
      return;
    }
    const totalSplit = (Number(splitPartner) || 0) + (Number(splitOwner) || 0);
    if (totalSplit !== 100) {
      setFormError(`Total split must equal 100% (currently ${totalSplit}%)`);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      if (isEditing && partnerId) {
        await updatePartner(
          {
            name,
            contact_info: contactInfo || null,
            notes: notes || null,
            default_split_partner: partnerPct,
            default_split_owner: ownerPct
          },
          partnerId,
          {
            onSuccess: () => {
              setToast({ isOpen: true, message: 'Partner updated successfully', type: 'success' });
              setTimeout(() => router.push('/partners'), 1500);
            },
            onError: () => {
              setToast({ isOpen: true, message: 'Failed to update partner', type: 'error' });
              setSubmitting(false);
            }
          }
        );
      } else {
        await insertPartner(
          {
            name,
            contact_info: contactInfo || null,
            notes: notes || null,
            default_split_partner: partnerPct,
            default_split_owner: ownerPct
          },
          {
            onSuccess: () => {
              setToast({ isOpen: true, message: 'Partner created successfully', type: 'success' });
              setTimeout(() => router.push('/partners'), 1500);
            },
            onError: () => {
              setToast({ isOpen: true, message: 'Failed to create partner', type: 'error' });
              setSubmitting(false);
            }
          }
        );
      }
    } catch (err) {
      console.error(err);
      setFormError('Failed to save partner. Please try again.');
      setSubmitting(false);
    }
  };

  if (isEditing && isLoading) {
    return (
      <div>
        <SectionHeader title="Edit Partner" description="Loading partner..." />
        <LoadingSpinner message="Loading partner..." />
      </div>
    );
  }

  if (isEditing && error) {
    return (
      <div>
        <SectionHeader title="Edit Partner" description="Unable to load partner" />
        <ErrorMessage error={error} onRetry={() => mutatePartner()} />
      </div>
    );
  }

  const totalSplit = (Number(splitPartner) || 0) + (Number(splitOwner) || 0);
  const splitError = totalSplit !== 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <SectionHeader
        title={isEditing ? 'Edit Partner' : 'New Partner'}
        description={isEditing ? 'Update partner information and profit split settings.' : 'Create a new sourcing partner. Set the default profit split that will apply to all clients assigned to this partner.'}
        actions={
          <button
            type="button"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: 'white',
              color: '#475569',
              fontWeight: '500',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onClick={() => router.push('/partners')}
          >
            ← Back to Partners
          </button>
        }
      />

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {formError && (
            <div style={{ padding: '0.875rem 1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: '#991b1b' }}>{formError}</p>
            </div>
          )}

          {/* Basic Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Basic Information</h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                Partner Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bob, Marketing Agency"
                required
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#059669';
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Contact Information</label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Email, Telegram, Phone, etc."
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#059669';
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>How to reach this partner for payments and communication</p>
            </div>
          </div>

          {/* Default Profit Split */}
          <div style={{ paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: '0.5rem' }}>Default Profit Split</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>This split will be applied to all clients assigned to this partner unless overridden per client.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Partner Share (%)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={splitPartner}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100)) {
                        setSplitPartner(val);
                      }
                    }}
                    placeholder="25"
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      paddingRight: '2.5rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#059669';
                      e.currentTarget.style.outline = 'none';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: '#94a3b8', pointerEvents: 'none' }}>%</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Owner Share (%)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={splitOwner}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100)) {
                        setSplitOwner(val);
                      }
                    }}
                    placeholder="75"
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      paddingRight: '2.5rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#059669';
                      e.currentTarget.style.outline = 'none';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: '#94a3b8', pointerEvents: 'none' }}>%</span>
                </div>
              </div>
            </div>

            {splitError && (
              <div style={{ padding: '0.75rem 1rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: '#92400e' }}>
                  Total must equal 100% (currently {totalSplit}%)
                </p>
              </div>
            )}

            <div style={{ padding: '0.875rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                <span style={{ color: '#64748b' }}>Total Split:</span>
                <span style={{ fontWeight: '600', color: totalSplit === 100 ? '#059669' : '#dc2626' }}>
                  {totalSplit}%
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Additional information about this partner..."
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                resize: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#059669';
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => router.push('/partners')}
              disabled={submitting}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                color: '#475569',
                fontWeight: '500',
                fontSize: '0.875rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = 'white')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || totalSplit !== 100}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                background: '#059669',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: submitting || totalSplit !== 100 ? 'not-allowed' : 'pointer',
                opacity: submitting || totalSplit !== 100 ? 0.6 : 1,
                transition: 'background-color 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => !submitting && totalSplit === 100 && (e.currentTarget.style.background = '#047857')}
              onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#059669')}
            >
              {submitting ? 'Saving...' : isEditing ? 'Update Partner' : 'Create Partner'}
            </button>
          </div>
        </form>
      </div>

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  );
}
