'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/DataTable';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import Link from 'next/link';

interface ReferralLinkUsage {
  id: string;
  referral_link_id: string;
  client_id: string | null;
  client_app_id: string | null;
  used_at: string;
  used_by: string | null;
  redeemed: boolean;
  redeemed_at: string | null;
  notes: string | null;
  clients?: {
    id: string;
    name: string;
    surname: string | null;
  } | null;
  client_apps?: {
    id: string;
    apps?: {
      name: string;
    } | null;
  } | null;
}

interface ReferralLinkWithStats {
  id: string;
  app_id: string;
  account_name: string | null;
  code: string | null;
  url: string;
  normalized_url: string | null;
  status: 'active' | 'inactive' | 'redeemed' | 'expired';
  url_validation_status: 'valid' | 'invalid' | 'needs_review' | 'pending';
  current_uses: number;
  max_uses: number | null;
  last_used_at: string | null;
  is_active: boolean;
  notes: string | null;
  apps?: {
    id: string;
    name: string;
  } | null;
  owner_client_id: string | null;
  clients?: {
    id: string;
    name: string;
    surname: string | null;
  } | null;
  unique_clients?: number;
  uses_last_7_days?: number;
  uses_last_30_days?: number;
  redeemedMoney?: number;
  totalPotential?: number;
  totalPaid?: number;
  missingMoney?: number;
}

interface ReferralDetailModalProps {
  referral: ReferralLinkWithStats | null;
  usages: ReferralLinkUsage[];
  onClose: () => void;
  onUsageUpdate?: () => void;
}

const usedByOptions = ['Jacopo', 'Luna', 'Marco'];

function ReferralDetailModal({ referral, usages, onClose, onUsageUpdate }: ReferralDetailModalProps) {
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string>('');
  const [editingClientSearch, setEditingClientSearch] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [editingRedeemed, setEditingRedeemed] = useState<boolean>(false);
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [editingUsedBy, setEditingUsedBy] = useState<string>('');
  const [showUsedByDropdown, setShowUsedByDropdown] = useState<boolean>(false);
  const [isSavingUsage, setIsSavingUsage] = useState(false);
  const [isAddingUsage, setIsAddingUsage] = useState(false);
  const [newUsageClientId, setNewUsageClientId] = useState<string>('');
  const [newUsageClientSearch, setNewUsageClientSearch] = useState<string>('');
  const [showNewUsageClientDropdown, setShowNewUsageClientDropdown] = useState<boolean>(false);
  const [newUsageUsedAt, setNewUsageUsedAt] = useState<string>('');
  const [newUsageUsedBy, setNewUsageUsedBy] = useState<string>('');
  const [showNewUsageUsedByDropdown, setShowNewUsageUsedByDropdown] = useState<boolean>(false);
  const [newUsageRedeemed, setNewUsageRedeemed] = useState<boolean>(false);
  const [newUsageNotes, setNewUsageNotes] = useState<string>('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; usageId: string | null }>({
    isOpen: false,
    usageId: null
  });
  const [markAllRedeemedModal, setMarkAllRedeemedModal] = useState<{ isOpen: boolean }>({ isOpen: false });
  const [isMarkingAllRedeemed, setIsMarkingAllRedeemed] = useState(false);
  const { data: allClients } = useSupabaseData({ 
    table: 'clients',
    select: 'id, name, surname',
    order: { column: 'name', ascending: true }
  });
  
  // Fetch promotions to calculate profit
  const { data: allPromotions } = useSupabaseData({ 
    table: 'promotions',
    select: '*'
  });
  
  // Fetch payments for this referral link
  const { data: payments, mutate: mutatePayments } = useSupabaseData({
    table: 'referral_link_payments' as any,
    select: '*',
    match: referral ? { referral_link_id: referral.id } : undefined,
    order: { column: 'paid_at', ascending: false }
  });
  
  const supabase = getSupabaseClient();
  
  // Payment modal states
  const [paymentModal, setPaymentModal] = useState<{ 
    isOpen: boolean; 
    usageIds: string[]; 
    calculatedAmount: number;
  }>({ isOpen: false, usageIds: [], calculatedAmount: 0 });
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentSource, setPaymentSource] = useState<string>('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  
  // Payment source options - stored in localStorage
  const PAYMENT_SOURCE_STORAGE_KEY = 'bonus_tracker_payment_sources';
  const DEFAULT_PAYMENT_SOURCES = useMemo(() => ['Revolut Marco', 'Revolut Jacopo', 'Revolut Luna'], []);
  
  const getPaymentSources = useCallback((): string[] => {
    if (typeof window === 'undefined') return DEFAULT_PAYMENT_SOURCES;
    try {
      const stored = localStorage.getItem(PAYMENT_SOURCE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PAYMENT_SOURCES;
      }
    } catch (e) {
      console.error('Error reading payment sources:', e);
    }
    return DEFAULT_PAYMENT_SOURCES;
  }, [DEFAULT_PAYMENT_SOURCES]);
  
  const [paymentSources, setPaymentSources] = useState<string[]>(getPaymentSources());
  
  useEffect(() => {
    setPaymentSources(getPaymentSources());
  }, [getPaymentSources]);
  
  const savePaymentSource = (source: string): void => {
    if (typeof window === 'undefined' || !source.trim()) return;
    try {
      const current = getPaymentSources();
      const sourceTrimmed = source.trim();
      if (!current.includes(sourceTrimmed)) {
        const updated = [sourceTrimmed, ...current];
        localStorage.setItem(PAYMENT_SOURCE_STORAGE_KEY, JSON.stringify(updated));
        setPaymentSources(updated);
      }
    } catch (e) {
      console.error('Error saving payment source:', e);
    }
  };

  // Filter clients based on search input (for editing)
  const filteredClients = useMemo(() => {
    if (!allClients || !Array.isArray(allClients)) return [];
    const searchTerm = isAddingUsage ? newUsageClientSearch : editingClientSearch;
    if (!searchTerm.trim()) return allClients;
    
    const searchLower = searchTerm.toLowerCase().trim();
    return allClients.filter((client: any) => {
      const fullName = `${client.name} ${client.surname || ''}`.trim().toLowerCase();
      const name = (client.name || '').toLowerCase();
      const surname = (client.surname || '').toLowerCase();
      
      return fullName.includes(searchLower) || 
             name.includes(searchLower) || 
             surname.includes(searchLower);
    });
  }, [allClients, editingClientSearch, newUsageClientSearch, isAddingUsage]);

  const handleEditUsage = (usage: ReferralLinkUsage) => {
    setEditingUsageId(usage.id);
    setEditingClientId(usage.client_id || '');
    // Set search text to current client name if exists
    if (usage.clients) {
      setEditingClientSearch(`${usage.clients.name} ${usage.clients.surname || ''}`.trim());
    } else {
      setEditingClientSearch('');
    }
    setEditingRedeemed(usage.redeemed || false);
    setEditingNotes(usage.notes || '');
    setEditingUsedBy(usage.used_by || '');
    setShowClientDropdown(true);
  };

  const handleCancelEdit = () => {
    setEditingUsageId(null);
    setEditingClientId('');
    setEditingClientSearch('');
    setEditingRedeemed(false);
    setEditingNotes('');
    setEditingUsedBy('');
    setShowClientDropdown(false);
  };

  const handleSelectClient = (clientId: string, clientName: string) => {
    setEditingClientId(clientId);
    setEditingClientSearch(clientName);
    setShowClientDropdown(false);
  };

  const handleSelectNewUsageClient = (clientId: string, clientName: string) => {
    setNewUsageClientId(clientId);
    setNewUsageClientSearch(clientName);
    setShowNewUsageClientDropdown(false);
  };

  const handleStartAddUsage = () => {
    setIsAddingUsage(true);
    setNewUsageClientId('');
    setNewUsageClientSearch('');
    setNewUsageUsedAt(new Date().toISOString().split('T')[0]); // Today's date as default
    setNewUsageUsedBy('');
    setNewUsageRedeemed(false);
    setNewUsageNotes('');
    setShowNewUsageClientDropdown(false);
  };

  const handleCancelAddUsage = () => {
    setIsAddingUsage(false);
    setNewUsageClientId('');
    setNewUsageClientSearch('');
    setNewUsageUsedAt('');
    setNewUsageUsedBy('');
    setNewUsageRedeemed(false);
    setNewUsageNotes('');
    setShowNewUsageClientDropdown(false);
  };

  const handleAddUsage = async () => {
    if (!supabase || !referral) return;
    
    if (!newUsageUsedAt.trim()) {
      alert('Date is required');
      return;
    }

    setIsSavingUsage(true);
    try {
      const insertData: any = {
        referral_link_id: referralData.id,
        used_at: newUsageUsedAt,
        used_by: newUsageUsedBy.trim() || null,
        redeemed: newUsageRedeemed,
        redeemed_at: newUsageRedeemed ? new Date().toISOString() : null,
        notes: newUsageNotes.trim() || null
      };
      
      if (newUsageClientId) {
        insertData.client_id = newUsageClientId;
      } else {
        insertData.client_id = null;
      }

      const { error } = await supabase
        .from('referral_link_usages' as any)
        .insert(insertData);

      if (error) throw error;

      // Update referral link stats
      await (supabase as any).rpc('update_referral_link_stats', { p_referral_link_id: referralData.id });

      // Trigger refresh of usage data
      if (onUsageUpdate) {
        onUsageUpdate();
      }

      // Reset form
      handleCancelAddUsage();
    } catch (error) {
      console.error('Error adding usage:', error);
      alert('Failed to add usage. Please try again.');
    } finally {
      setIsSavingUsage(false);
    }
  };

  // Calculate dropdown position when editing
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [newUsageDropdownPosition, setNewUsageDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [usedByDropdownPosition, setUsedByDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [newUsageUsedByDropdownPosition, setNewUsageUsedByDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const newUsageInputRef = useRef<HTMLInputElement>(null);
  const usedByInputRef = useRef<HTMLInputElement>(null);
  const newUsageUsedByInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (showClientDropdown && editingUsageId && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    } else {
      setDropdownPosition(null);
    }
  }, [showClientDropdown, editingUsageId]);

  useEffect(() => {
    if (showNewUsageClientDropdown && isAddingUsage && newUsageInputRef.current) {
      const rect = newUsageInputRef.current.getBoundingClientRect();
      setNewUsageDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    } else {
      setNewUsageDropdownPosition(null);
    }
  }, [showNewUsageClientDropdown, isAddingUsage]);

  useEffect(() => {
    if (showUsedByDropdown && editingUsageId && usedByInputRef.current) {
      const rect = usedByInputRef.current.getBoundingClientRect();
      setUsedByDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    } else {
      setUsedByDropdownPosition(null);
    }
  }, [showUsedByDropdown, editingUsageId]);

  useEffect(() => {
    if (showNewUsageUsedByDropdown && isAddingUsage && newUsageUsedByInputRef.current) {
      const rect = newUsageUsedByInputRef.current.getBoundingClientRect();
      setNewUsageUsedByDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    } else {
      setNewUsageUsedByDropdownPosition(null);
    }
  }, [showNewUsageUsedByDropdown, isAddingUsage]);

  // Filter used by options based on input
  const filteredUsedByOptions = useMemo(() => {
    const searchTerm = isAddingUsage ? newUsageUsedBy : editingUsedBy;
    if (!searchTerm.trim()) return usedByOptions;
    
    const searchLower = searchTerm.toLowerCase().trim();
    return usedByOptions.filter((name) => 
      name.toLowerCase().includes(searchLower)
    );
  }, [editingUsedBy, newUsageUsedBy, isAddingUsage]);

  const handleSelectUsedBy = (name: string) => {
    if (isAddingUsage) {
      setNewUsageUsedBy(name);
    } else {
      setEditingUsedBy(name);
    }
    setShowUsedByDropdown(false);
    setShowNewUsageUsedByDropdown(false);
  };

  const handleSaveUsage = async (usageId: string) => {
    if (!supabase) return;
    
    // If redeeming (changing from unredeemed to redeemed), open payment modal
    const currentUsage = usages.find(u => u.id === usageId);
    const isRedeeming = editingRedeemed && !currentUsage?.redeemed;
    
    if (isRedeeming) {
      // Calculate amount for this single usage
      const ourReward = activePromotion?.our_reward || 0;
      const calculatedAmount = Number(ourReward);
      
      setPaymentModal({ 
        isOpen: true, 
        usageIds: [usageId], 
        calculatedAmount 
      });
      setPaymentAmount(calculatedAmount.toFixed(2));
      setPaymentSource('');
      return;
    }
    
    // If unredeeming or other changes, save directly
    setIsSavingUsage(true);
    try {
      const updateData: any = {
        redeemed: editingRedeemed,
        redeemed_at: editingRedeemed ? new Date().toISOString() : null,
        notes: editingNotes.trim() || null,
        used_by: editingUsedBy.trim() || null
      };
      
      if (editingClientId) {
        updateData.client_id = editingClientId;
      } else {
        updateData.client_id = null;
      }

      const { error } = await supabase
        .from('referral_link_usages' as any)
        .update(updateData)
        .eq('id', usageId);

      if (error) throw error;

      // Trigger refresh of usage data
      if (onUsageUpdate) {
        onUsageUpdate();
      }
    } catch (error) {
      console.error('Error updating usage:', error);
      alert('Failed to update usage. Please try again.');
    } finally {
      setIsSavingUsage(false);
      setEditingUsageId(null);
    }
  };

  const handleDeleteUsage = (usageId: string) => {
    setDeleteModal({ isOpen: true, usageId });
  };

  const handleMarkAllUsagesAsRedeemed = async () => {
    if (!supabase || !referral) return;
    
    // Get all unredeemed usages for this referral link
    const unredeemedUsages = usages.filter(u => !u.redeemed);
    
    if (unredeemedUsages.length === 0) {
      setMarkAllRedeemedModal({ isOpen: false });
      return;
    }

    // Calculate total amount and open payment modal
    const ourReward = activePromotion?.our_reward || 0;
    const calculatedAmount = unredeemedUsages.length * Number(ourReward);
    
    setMarkAllRedeemedModal({ isOpen: false });
    setPaymentModal({ 
      isOpen: true, 
      usageIds: unredeemedUsages.map(u => u.id), 
      calculatedAmount 
    });
    setPaymentAmount(calculatedAmount.toFixed(2));
    setPaymentSource('');
  };
  
  // Handle payment save
  const handleSavePayment = async () => {
    if (!supabase || !referral) return;
    
    if (!paymentAmount.trim() || !paymentSource.trim()) {
      alert('Please fill in amount and payment source');
      return;
    }
    
    setIsSavingPayment(true);
    try {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }
      
      // Create payment record
      const { error: paymentError } = await supabase
        .from('referral_link_payments' as any)
        .insert({
          referral_link_id: referral.id,
          amount: amount,
          payment_source: paymentSource.trim(),
          paid_at: new Date().toISOString()
        });
      
      if (paymentError) throw paymentError;
      
      // Update usages to redeemed only if there are usageIds (from redemption workflow)
      if (paymentModal.usageIds.length > 0) {
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('referral_link_usages' as any)
          .update({ 
            redeemed: true, 
            redeemed_at: now 
          })
          .in('id', paymentModal.usageIds);
        
        if (updateError) throw updateError;
      }
      
      // Save payment source to localStorage
      savePaymentSource(paymentSource.trim());
      
      // Refresh data
      if (onUsageUpdate) {
        onUsageUpdate();
      }
      if (mutatePayments) {
        mutatePayments();
      }
      
      // Close modal
      setPaymentModal({ isOpen: false, usageIds: [], calculatedAmount: 0 });
      setPaymentAmount('');
      setPaymentSource('');
    } catch (error) {
      console.error('Failed to save payment:', error);
      alert('Failed to save payment. Please try again.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const confirmDeleteUsage = async () => {
    if (!supabase || !deleteModal.usageId) return;
    
    setIsSavingUsage(true);
    try {
      const { error } = await supabase
        .from('referral_link_usages' as any)
        .delete()
        .eq('id', deleteModal.usageId);

      if (error) throw error;

      // Trigger refresh of usage data
      if (onUsageUpdate) {
        onUsageUpdate();
      }
      
      setDeleteModal({ isOpen: false, usageId: null });
    } catch (error) {
      console.error('Error deleting usage:', error);
      alert('Failed to delete usage. Please try again.');
    } finally {
      setIsSavingUsage(false);
    }
  };

  // Get active promotion for this referral's app to calculate profit
  const activePromotion = useMemo(() => {
    if (!referral || !allPromotions || !Array.isArray(allPromotions)) return null;
    const appPromotions = allPromotions.filter((p: any) => p.app_id === referral.app_id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find active promotion (check is_active flag and dates)
    return appPromotions.find((p: any) => {
      if (p.is_active === false) return false;
      if (p.is_active === true) {
        const startDate = p.start_date ? new Date(p.start_date) : null;
        const endDate = p.end_date ? new Date(p.end_date) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);
        if (startDate && today < startDate) return false;
        if (endDate && today > endDate) return false;
        return true;
      }
      // Fallback to date-based logic
      const startDate = p.start_date ? new Date(p.start_date) : null;
      const endDate = p.end_date ? new Date(p.end_date) : null;
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);
      if (startDate && today < startDate) return false;
      if (endDate && today > endDate) return false;
      return true;
    }) || appPromotions[0] || null; // Fallback to first promotion if no active one
  }, [referral, allPromotions]);

  const stats = useMemo(() => {
    const totalUsages = usages.length;
    const uniqueClients = new Set(usages.filter(u => u.client_id).map(u => u.client_id)).size;
    const redeemed = usages.filter(u => u.redeemed).length;
    const unredeemed = totalUsages - redeemed;
    const last7Days = usages.filter(u => {
      const usedAt = new Date(u.used_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return usedAt >= sevenDaysAgo;
    }).length;
    const last30Days = usages.filter(u => {
      const usedAt = new Date(u.used_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return usedAt >= thirtyDaysAgo;
    }).length;
    const redeemedPercent = totalUsages > 0 ? Math.round((redeemed / totalUsages) * 100) : 0;
    
    // Calculate money: redeemed money / total potential
    const ourReward = activePromotion?.our_reward || 0;
    // First number: redeemed money (redeemed uses × reward)
    const redeemedMoney = redeemed * Number(ourReward);
    // Second number: total potential (all uses × reward)
    const totalPotential = totalUsages * Number(ourReward);
    
    // Calculate total paid amount
    const paymentsArray = Array.isArray(payments) ? payments : [];
    const totalPaid = paymentsArray.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const missingMoney = redeemedMoney - totalPaid;

    return {
      totalUsages,
      uniqueClients,
      redeemed,
      unredeemed,
      redeemedPercent,
      last7Days,
      last30Days,
      redeemedMoney,
      totalPotential,
      totalPaid,
      missingMoney,
      ourReward
    };
  }, [usages, activePromotion, payments]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#94a3b8';
      case 'redeemed': return '#3b82f6';
      case 'expired': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getValidationColor = (status: string) => {
    switch (status) {
      case 'valid': return '#10b981';
      case 'invalid': return '#ef4444';
      case 'needs_review': return '#f59e0b';
      case 'pending': return '#94a3b8';
      default: return '#64748b';
    }
  };

  if (!referral) return null;

  // TypeScript assertion: referral is not null after the check above
  const referralData = referral;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem'
      }}
      onClick={(e) => {
        // Don't close if payment modal is open
        if (!paymentModal.isOpen) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>Referral Details</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.25rem 0.5rem'
            }}
          >
            ×
          </button>
        </div>

        {/* Referral Info */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>App</div>
              <div style={{ fontWeight: '600' }}>{referralData.apps?.name || 'Unknown'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Account</div>
              <div style={{ fontWeight: '600' }}>{referralData.account_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Code</div>
              <div style={{ fontWeight: '600' }}>{referralData.code || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Status</div>
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  backgroundColor: getStatusColor(referralData.status),
                  color: 'white'
                }}
              >
                {referralData.status}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>URL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <a
                href={referralData.normalized_url || referralData.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' }}
              >
                {referralData.normalized_url || referralData.url}
              </a>
              {referralData.url_validation_status !== 'valid' && (
                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    backgroundColor: getValidationColor(referralData.url_validation_status),
                    color: 'white'
                  }}
                >
                  {referralData.url_validation_status}
                </span>
              )}
            </div>
          </div>

          {referralData.notes && (
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>Notes</div>
              <div>{referralData.notes}</div>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>{stats.totalUsages}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total Uses</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>{stats.uniqueClients}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Unique Clients</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>{stats.redeemedPercent}%</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Redeemed</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>{stats.last7Days}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Last 7 Days</div>
          </div>
        </div>
        
        {/* Money Section */}
        <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '2px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#065f46' }}>Total Money (Redeemed)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#065f46' }}>
              €{stats.redeemedMoney.toFixed(2)} / €{stats.totalPotential.toFixed(2)}
            </div>
          </div>
          {stats.missingMoney > 0 && (
            <div style={{ fontSize: '0.875rem', color: '#ef4444', marginTop: '0.5rem' }}>
              Missing: €{stats.missingMoney.toFixed(2)}
            </div>
          )}
          {stats.missingMoney <= 0 && stats.totalPaid > 0 && (
            <div style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '0.5rem' }}>
              Fully paid
            </div>
          )}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPaymentModal({ isOpen: true, usageIds: [], calculatedAmount: 0 });
                setPaymentAmount('');
                setPaymentSource('');
              }}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              + Add Payment
            </button>
          </div>
          
          {/* Payments List */}
          {payments && Array.isArray(payments) && payments.length > 0 ? (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', width: '100%', boxSizing: 'border-box', marginTop: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>Where</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment: any) => (
                    <tr key={payment.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
                        {new Date(payment.paid_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#334155' }}>{payment.payment_source}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#334155', textAlign: 'right', fontWeight: '600' }}>
                        €{Number(payment.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px', marginTop: '1rem' }}>
              No payments recorded yet
            </div>
          )}
        </div>

        {/* Usage List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', margin: 0 }}>Usage History</h3>
            {!isAddingUsage && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setMarkAllRedeemedModal({ isOpen: true })}
                  disabled={isMarkingAllRedeemed || usages.length === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    backgroundColor: isMarkingAllRedeemed ? '#94a3b8' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (isMarkingAllRedeemed || usages.length === 0) ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: (isMarkingAllRedeemed || usages.length === 0) ? 0.6 : 1
                  }}
                >
                  {isMarkingAllRedeemed ? 'Marking...' : 'Mark All as Redeemed'}
                </button>
                <button
                  onClick={handleStartAddUsage}
                  disabled={isSavingUsage}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingUsage ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: isSavingUsage ? 0.6 : 1
                  }}
                >
                  + Add Usage
                </button>
              </div>
            )}
          </div>
          {usages.length === 0 && !isAddingUsage ? (
            <EmptyState title="No usages yet" message="This referral link hasn't been used yet." />
          ) : (
            <div className="table-container" style={{ overflow: 'visible', position: 'relative' }}>
              <table style={{ tableLayout: 'auto', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>Date</th>
                    <th style={{ width: '15%' }}>Used By</th>
                    <th style={{ width: '18%' }}>Client</th>
                    <th style={{ width: '10%' }}>App</th>
                    <th style={{ width: '10%' }}>Redeemed</th>
                    <th style={{ width: '15%' }}>Notes</th>
                    <th style={{ width: '20%', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isAddingUsage && (
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <td style={{ fontSize: '0.85rem' }}>
                        <input
                          type="date"
                          value={newUsageUsedAt}
                          onChange={(e) => setNewUsageUsedAt(e.target.value)}
                          disabled={isSavingUsage}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.5rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          required
                        />
                      </td>
                      <td style={{ position: 'relative', overflow: 'visible', fontSize: '0.85rem' }}>
                        <div style={{ position: 'relative', width: '100%', zIndex: 1 }}>
                          <input
                            ref={newUsageUsedByInputRef}
                            type="text"
                            value={newUsageUsedBy}
                            onChange={(e) => {
                              setNewUsageUsedBy(e.target.value);
                              setShowNewUsageUsedByDropdown(true);
                            }}
                            onFocus={() => setShowNewUsageUsedByDropdown(true)}
                            disabled={isSavingUsage}
                            placeholder="Type or select..."
                            style={{
                              width: '100%',
                              padding: '0.4rem 0.5rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            onBlur={(e) => {
                              setTimeout(() => setShowNewUsageUsedByDropdown(false), 200);
                            }}
                          />
                          {showNewUsageUsedByDropdown && filteredUsedByOptions.length > 0 && newUsageUsedByDropdownPosition && (
                            <div
                              style={{
                                position: 'fixed',
                                top: `${newUsageUsedByDropdownPosition.top}px`,
                                left: `${newUsageUsedByDropdownPosition.left}px`,
                                backgroundColor: '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                maxHeight: '200px',
                                overflowY: 'auto',
                                zIndex: 10000,
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                minWidth: '150px',
                                maxWidth: '300px'
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {filteredUsedByOptions.map((name) => (
                                <div
                                  key={name}
                                  onClick={() => handleSelectUsedBy(name)}
                                  style={{
                                    padding: '0.75rem',
                                    cursor: 'pointer',
                                    backgroundColor: newUsageUsedBy === name ? '#eff6ff' : '#fff',
                                    borderBottom: '1px solid #f1f5f9',
                                    transition: 'background-color 0.15s'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (newUsageUsedBy !== name) {
                                      e.currentTarget.style.backgroundColor = '#f8fafc';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (newUsageUsedBy !== name) {
                                      e.currentTarget.style.backgroundColor = '#fff';
                                    }
                                  }}
                                >
                                  <div style={{ fontWeight: newUsageUsedBy === name ? '600' : '400', fontSize: '0.875rem' }}>
                                    {name}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ position: 'relative', overflow: 'visible', fontSize: '0.85rem' }}>
                        <div style={{ position: 'relative', width: '100%', zIndex: 1 }}>
                          <input
                            ref={newUsageInputRef}
                            type="text"
                            value={newUsageClientSearch}
                            onChange={(e) => {
                              setNewUsageClientSearch(e.target.value);
                              setShowNewUsageClientDropdown(true);
                            }}
                            onFocus={() => setShowNewUsageClientDropdown(true)}
                            placeholder="Search client..."
                            disabled={isSavingUsage}
                            style={{
                              width: '100%',
                              padding: '0.4rem 0.5rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                            onBlur={(e) => {
                              setTimeout(() => setShowNewUsageClientDropdown(false), 200);
                            }}
                          />
                          {showNewUsageClientDropdown && filteredClients.length > 0 && newUsageDropdownPosition && (
                            <div
                              style={{
                                position: 'fixed',
                                top: `${newUsageDropdownPosition.top}px`,
                                left: `${newUsageDropdownPosition.left}px`,
                                backgroundColor: '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                maxHeight: '200px',
                                overflowY: 'auto',
                                zIndex: 10000,
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                minWidth: '250px',
                                maxWidth: '400px'
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {filteredClients.slice(0, 10).map((client: any) => {
                                const fullName = `${client.name} ${client.surname || ''}`.trim();
                                const isSelected = newUsageClientId === client.id;
                                return (
                                  <div
                                    key={client.id}
                                    onClick={() => handleSelectNewUsageClient(client.id, fullName)}
                                    style={{
                                      padding: '0.75rem',
                                      cursor: 'pointer',
                                      backgroundColor: isSelected ? '#eff6ff' : '#fff',
                                      borderBottom: '1px solid #f1f5f9',
                                      transition: 'background-color 0.15s'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isSelected) {
                                        e.currentTarget.style.backgroundColor = '#f8fafc';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isSelected) {
                                        e.currentTarget.style.backgroundColor = '#fff';
                                      }
                                    }}
                                  >
                                    <div style={{ fontWeight: isSelected ? '600' : '400', fontSize: '0.875rem' }}>
                                      {fullName}
                                    </div>
                                  </div>
                                );
                              })}
                              {filteredClients.length > 10 && (
                                <div style={{ 
                                  padding: '0.5rem', 
                                  fontSize: '0.75rem', 
                                  color: '#64748b', 
                                  textAlign: 'center',
                                  borderTop: '1px solid #f1f5f9'
                                }}>
                                  {filteredClients.length - 10} more... (type to filter)
                                </div>
                              )}
                            </div>
                          )}
                          {showNewUsageClientDropdown && newUsageClientSearch.trim() && filteredClients.length === 0 && newUsageDropdownPosition && (
                            <div
                              style={{
                                position: 'fixed',
                                top: `${newUsageDropdownPosition.top}px`,
                                left: `${newUsageDropdownPosition.left}px`,
                                backgroundColor: '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '0.75rem',
                                zIndex: 10000,
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                minWidth: '250px',
                                maxWidth: '400px',
                                fontSize: '0.875rem',
                                color: '#64748b'
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              No clients found
                            </div>
                          )}
                          {newUsageClientId && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewUsageClientId('');
                                setNewUsageClientSearch('');
                              }}
                              disabled={isSavingUsage}
                              style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '1.2rem',
                                color: '#64748b',
                                padding: '0.25rem',
                                lineHeight: 1
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>—</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={newUsageRedeemed}
                            onChange={(e) => setNewUsageRedeemed(e.target.checked)}
                            disabled={isSavingUsage}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.8rem' }}>Redeemed</span>
                        </label>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <textarea
                          value={newUsageNotes}
                          onChange={(e) => setNewUsageNotes(e.target.value)}
                          disabled={isSavingUsage}
                          style={{
                            width: '100%',
                            padding: '0.4rem 0.5rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            outline: 'none',
                            boxSizing: 'border-box',
                            minHeight: '60px',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                          }}
                          placeholder="Add notes..."
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', alignItems: 'center' }}>
                          <button
                            onClick={handleAddUsage}
                            disabled={isSavingUsage}
                            style={{
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isSavingUsage ? 'not-allowed' : 'pointer',
                              fontWeight: '500',
                              opacity: isSavingUsage ? 0.6 : 1,
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                          >
                            {isSavingUsage ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelAddUsage}
                            disabled={isSavingUsage}
                            style={{
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#e2e8f0',
                              color: '#475569',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isSavingUsage ? 'not-allowed' : 'pointer',
                              fontWeight: '500',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {usages.map((usage) => {
                    const clientName = usage.clients
                      ? `${usage.clients.name} ${usage.clients.surname || ''}`.trim()
                      : '—';
                    const appName = usage.client_apps?.apps?.name || '—';
                    const isEditing = editingUsageId === usage.id;

                    return (
                      <tr key={usage.id}>
                        <td style={{ fontSize: '0.85rem' }}>{new Date(usage.used_at).toLocaleString('it-IT')}</td>
                        <td style={{ position: 'relative', overflow: 'visible', fontSize: '0.85rem' }}>
                          {isEditing ? (
                            <div style={{ position: 'relative', width: '100%', zIndex: 1 }}>
                              <input
                                ref={usedByInputRef}
                                type="text"
                                value={editingUsedBy}
                                onChange={(e) => {
                                  setEditingUsedBy(e.target.value);
                                  setShowUsedByDropdown(true);
                                }}
                                onFocus={() => setShowUsedByDropdown(true)}
                                disabled={isSavingUsage}
                                placeholder="Type or select..."
                                style={{
                                  width: '100%',
                                  padding: '0.4rem 0.5rem',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                                onBlur={(e) => {
                                  setTimeout(() => setShowUsedByDropdown(false), 200);
                                }}
                              />
                              {showUsedByDropdown && filteredUsedByOptions.length > 0 && usedByDropdownPosition && (
                                <div
                                  style={{
                                    position: 'fixed',
                                    top: `${usedByDropdownPosition.top}px`,
                                    left: `${usedByDropdownPosition.left}px`,
                                    backgroundColor: '#fff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 10000,
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                    minWidth: '150px',
                                    maxWidth: '300px'
                                  }}
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  {filteredUsedByOptions.map((name) => (
                                    <div
                                      key={name}
                                      onClick={() => handleSelectUsedBy(name)}
                                      style={{
                                        padding: '0.75rem',
                                        cursor: 'pointer',
                                        backgroundColor: editingUsedBy === name ? '#eff6ff' : '#fff',
                                        borderBottom: '1px solid #f1f5f9',
                                        transition: 'background-color 0.15s'
                                      }}
                                      onMouseEnter={(e) => {
                                        if (editingUsedBy !== name) {
                                          e.currentTarget.style.backgroundColor = '#f8fafc';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (editingUsedBy !== name) {
                                          e.currentTarget.style.backgroundColor = '#fff';
                                        }
                                      }}
                                    >
                                      <div style={{ fontWeight: editingUsedBy === name ? '600' : '400', fontSize: '0.875rem' }}>
                                        {name}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            usage.used_by || '—'
                          )}
                        </td>
                        <td style={{ position: 'relative', overflow: 'visible', fontSize: '0.85rem' }}>
                          {isEditing ? (
                            <div style={{ position: 'relative', width: '100%', zIndex: 1 }}>
                              <input
                                ref={inputRef}
                                type="text"
                                value={editingClientSearch}
                                onChange={(e) => {
                                  setEditingClientSearch(e.target.value);
                                  setShowClientDropdown(true);
                                }}
                                onFocus={() => setShowClientDropdown(true)}
                                placeholder="Search client..."
                                style={{
                                  width: '100%',
                                  padding: '0.4rem 0.5rem',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                                disabled={isSavingUsage}
                                onBlur={(e) => {
                                  // Delay to allow click on dropdown item
                                  setTimeout(() => setShowClientDropdown(false), 200);
                                }}
                              />
                              {showClientDropdown && filteredClients.length > 0 && dropdownPosition && (
                                <div
                                  style={{
                                    position: 'fixed',
                                    top: `${dropdownPosition.top}px`,
                                    left: `${dropdownPosition.left}px`,
                                    backgroundColor: '#fff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 10000,
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                    minWidth: '250px',
                                    maxWidth: '400px'
                                  }}
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  {filteredClients.slice(0, 10).map((client: any) => {
                                    const fullName = `${client.name} ${client.surname || ''}`.trim();
                                    const isSelected = editingClientId === client.id;
                                    return (
                                      <div
                                        key={client.id}
                                        onClick={() => handleSelectClient(client.id, fullName)}
                                        style={{
                                          padding: '0.75rem',
                                          cursor: 'pointer',
                                          backgroundColor: isSelected ? '#eff6ff' : '#fff',
                                          borderBottom: '1px solid #f1f5f9',
                                          transition: 'background-color 0.15s'
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) {
                                            e.currentTarget.style.backgroundColor = '#f8fafc';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) {
                                            e.currentTarget.style.backgroundColor = '#fff';
                                          }
                                        }}
                                      >
                                        <div style={{ fontWeight: isSelected ? '600' : '400', fontSize: '0.875rem' }}>
                                          {fullName}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {filteredClients.length > 10 && (
                                    <div style={{ 
                                      padding: '0.5rem', 
                                      fontSize: '0.75rem', 
                                      color: '#64748b', 
                                      textAlign: 'center',
                                      borderTop: '1px solid #f1f5f9'
                                    }}>
                                      {filteredClients.length - 10} more... (type to filter)
                                    </div>
                                  )}
                                </div>
                              )}
                              {showClientDropdown && editingClientSearch.trim() && filteredClients.length === 0 && dropdownPosition && (
                                <div
                                  style={{
                                    position: 'fixed',
                                    top: `${dropdownPosition.top}px`,
                                    left: `${dropdownPosition.left}px`,
                                    backgroundColor: '#fff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    padding: '0.75rem',
                                    zIndex: 10000,
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                    minWidth: '250px',
                                    maxWidth: '400px',
                                    fontSize: '0.875rem',
                                    color: '#64748b'
                                  }}
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  No clients found
                                </div>
                              )}
                              {editingClientId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingClientId('');
                                    setEditingClientSearch('');
                                  }}
                                  style={{
                                    position: 'absolute',
                                    right: '0.5rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.2rem',
                                    color: '#64748b',
                                    padding: '0.25rem',
                                    lineHeight: 1
                                  }}
                                  disabled={isSavingUsage}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ) : (
                            usage.client_id ? (
                              <Link 
                                href={`/clients/${usage.client_id}`} 
                                style={{ color: '#2563eb', textDecoration: 'none' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = 'none';
                                }}
                              >
                                {clientName}
                              </Link>
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No client</span>
                            )
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {appName !== '—' ? (
                            <span style={{ color: '#64748b' }}>{appName}</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {isEditing ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={editingRedeemed}
                                onChange={(e) => setEditingRedeemed(e.target.checked)}
                                disabled={isSavingUsage}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.8rem' }}>Redeemed</span>
                            </label>
                          ) : (
                            usage.redeemed ? (
                              <span className="badge success">Yes</span>
                            ) : (
                              <span className="badge" style={{ backgroundColor: '#e2e8f0', color: '#64748b' }}>
                                No
                              </span>
                            )
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {isEditing ? (
                            <textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              disabled={isSavingUsage}
                              style={{
                                width: '100%',
                                padding: '0.4rem 0.5rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                                minHeight: '60px',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                              }}
                              placeholder="Add notes..."
                            />
                          ) : (
                            usage.notes || '—'
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', alignItems: 'center' }}>
                              <button
                                onClick={() => handleSaveUsage(usage.id)}
                                disabled={isSavingUsage}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isSavingUsage ? 'not-allowed' : 'pointer',
                                  fontWeight: '500',
                                  opacity: isSavingUsage ? 0.6 : 1,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                {isSavingUsage ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSavingUsage}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#e2e8f0',
                                  color: '#475569',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isSavingUsage ? 'not-allowed' : 'pointer',
                                  fontWeight: '500',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', alignItems: 'center' }}>
                              <button
                                onClick={() => handleEditUsage(usage)}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '500',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUsage(usage.id)}
                                disabled={isSavingUsage}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isSavingUsage ? 'not-allowed' : 'pointer',
                                  fontWeight: '500',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  opacity: isSavingUsage ? 0.6 : 1
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Payment Modal */}
      {paymentModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}
          onClick={() => {
            if (!isSavingPayment) {
              setPaymentModal({ isOpen: false, usageIds: [], calculatedAmount: 0 });
              setPaymentAmount('');
              setPaymentSource('');
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              zIndex: 10002
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Add Payment
            </h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#334155' }}>
                Amount (€) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                disabled={isSavingPayment}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
                placeholder="0.00"
              />
              {paymentModal.calculatedAmount > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Calculated: €{paymentModal.calculatedAmount.toFixed(2)} ({paymentModal.usageIds.length} usage{paymentModal.usageIds.length !== 1 ? 's' : ''})
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#334155' }}>
                Where <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={paymentSource}
                onChange={(e) => setPaymentSource(e.target.value)}
                disabled={isSavingPayment}
                placeholder="e.g., Revolut Marco, Revolut Jacopo"
                list="payment-sources"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
                onBlur={() => {
                  if (paymentSource.trim()) {
                    savePaymentSource(paymentSource.trim());
                  }
                }}
              />
              <datalist id="payment-sources">
                {paymentSources.map((source: string) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setPaymentModal({ isOpen: false, usageIds: [], calculatedAmount: 0 });
                  setPaymentAmount('');
                  setPaymentSource('');
                }}
                disabled={isSavingPayment}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSavingPayment ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePayment}
                disabled={isSavingPayment}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: isSavingPayment ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSavingPayment ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                {isSavingPayment ? 'Saving...' : paymentModal.usageIds.length > 0 ? 'Save Payment & Mark as Redeemed' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Mark All as Redeemed Confirmation Modal */}
      <ConfirmationModal
        isOpen={markAllRedeemedModal.isOpen}
        title="Mark All Usages as Redeemed?"
        message={`Are you sure you want to mark all ${usages.filter(u => !u.redeemed).length} unredeemed usage${usages.filter(u => !u.redeemed).length !== 1 ? 's' : ''} as 'Redeemed'? You can still edit individual usages to unredeem them later.`}
        confirmLabel="Mark All as Redeemed"
        cancelLabel="Cancel"
        variant="info"
        onConfirm={handleMarkAllUsagesAsRedeemed}
        onCancel={() => setMarkAllRedeemedModal({ isOpen: false })}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Usage Record"
        message="Are you sure you want to delete this usage record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteUsage}
        onCancel={() => setDeleteModal({ isOpen: false, usageId: null })}
      />
    </div>
  );
}

interface ReferralEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  referral: ReferralLinkWithStats | null;
  appId: string | null;
  onSave: () => void;
}

function ReferralEditModal({ isOpen, onClose, referral, appId, onSave }: ReferralEditModalProps) {
  const [accountName, setAccountName] = useState('');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [maxUses, setMaxUses] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'redeemed' | 'expired'>('active');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (referral) {
      setAccountName(referral.account_name || '');
      setCode(referral.code || '');
      setUrl(referral.url || '');
      setMaxUses(referral.max_uses?.toString() || '');
      setStatus(referral.status);
      setNotes(referral.notes || '');
    } else {
      setAccountName('');
      setCode('');
      setUrl('');
      setMaxUses('');
      setStatus('active');
      setNotes('');
    }
    setError(null);
  }, [referral, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!appId) {
      setError('Please select an app first');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      let finalUrl: string;
      let normalizedUrl: string | null = null;
      let urlValidationStatus: string = 'pending';
      let extractedCode: string | null = code.trim() || null;

      // If URL is not provided, generate a placeholder based on code or account
      if (!url.trim()) {
        // Generate placeholder URL if code exists, otherwise use account name
        const placeholderCode = extractedCode || accountName.trim().replace(/\s+/g, '').toLowerCase() || 'referral';
        finalUrl = `https://referral.placeholder/${placeholderCode}`;
      } else {
        finalUrl = url.trim();
        // Normalize and validate URL using SQL functions
        const { data: normalizedUrlData } = await (supabase as any).rpc('normalize_referral_url', { p_url: finalUrl });
        const { data: validationStatusData } = await (supabase as any).rpc('validate_referral_url', { p_url: finalUrl });
        const { data: extractedCodeData } = await (supabase as any).rpc('extract_referral_code', { p_url: finalUrl });

        normalizedUrl = normalizedUrlData || finalUrl;
        urlValidationStatus = validationStatusData || 'pending';
        extractedCode = extractedCodeData || extractedCode;
      }

      const referralData: any = {
        app_id: appId,
        account_name: accountName.trim() || null,
        code: extractedCode,
        url: finalUrl,
        normalized_url: normalizedUrl || finalUrl,
        url_validation_status: urlValidationStatus,
        max_uses: maxUses ? parseInt(maxUses) : null,
        // Only save status if it's 'redeemed' or 'expired' (manual statuses)
        // Otherwise, status is determined automatically by app/promotion active status
        status: (status === 'redeemed' || status === 'expired') ? status : 'active',
        is_active: (status === 'redeemed' || status === 'expired') ? false : true, // Will be overridden by app/promotion logic
        notes: notes.trim() || null,
        current_uses: referral?.current_uses || 0
      };

      if (referral) {
        // Update existing
        const { error: updateError } = await supabase
          .from('referral_links')
          .update(referralData)
          .eq('id', referral.id);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('referral_links')
          .insert(referralData);

        if (insertError) throw insertError;
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Error saving referral:', err);
      setError(err.message || 'Failed to save referral link');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            {referral ? 'Edit Referral Link' : 'Add Referral Link'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.25rem 0.5rem'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#334155' }}>
              Account Name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
              placeholder="e.g., Martinelli"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#334155' }}>
              Code (optional - will be extracted from URL if not provided)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
              placeholder="e.g., gs7d8rqt"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#334155' }}>
              URL (optional)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
              placeholder="https://invite.kraken.com/JDNW/..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#334155' }}>
              Max Uses (leave empty for unlimited)
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
              placeholder="e.g., 5"
              min="1"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#334155' }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              disabled={status !== 'redeemed' && status !== 'expired'}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: (status !== 'redeemed' && status !== 'expired') ? '#f1f5f9' : 'white',
                cursor: (status !== 'redeemed' && status !== 'expired') ? 'not-allowed' : 'pointer',
                color: (status !== 'redeemed' && status !== 'expired') ? '#94a3b8' : '#334155'
              }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="redeemed">Redeemed</option>
              <option value="expired">Expired</option>
            </select>
            {(status !== 'redeemed' && status !== 'expired') && (
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Status is automatically determined by app/promotion active status. Only &quot;Redeemed&quot; and &quot;Expired&quot; can be set manually.
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#334155' }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem',
                minHeight: '80px',
                resize: 'vertical'
              }}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e2e8f0',
              color: '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isSaving ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            {isSaving ? 'Saving...' : (referral ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReferralLinksPage() {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [validationFilter, setValidationFilter] = useState<string>('all');
  const [appSearchFilter, setAppSearchFilter] = useState<string>('');
  const [selectedReferral, setSelectedReferral] = useState<ReferralLinkWithStats | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReferral, setEditingReferral] = useState<ReferralLinkWithStats | null>(null);
  const [markAllRedeemedModal, setMarkAllRedeemedModal] = useState<{ isOpen: boolean }>({ isOpen: false });
  const [isMarkingAllRedeemed, setIsMarkingAllRedeemed] = useState(false);

  const {
    data: referralLinks,
    isLoading,
    error,
    mutate,
    isDemo
  } = useSupabaseData({
    table: 'referral_links',
    select: '*, apps(*), clients!owner_client_id(*)'
  });
  
  // Fetch all usages and payments for money calculation
  const { data: allUsages } = useSupabaseData({
    table: 'referral_link_usages' as any,
    select: 'id, referral_link_id, redeemed, used_at'
  });
  
  const { data: allPayments } = useSupabaseData({
    table: 'referral_link_payments' as any,
    select: '*'
  });
  
  const { data: apps } = useSupabaseData({ 
    table: 'apps',
    order: { column: 'name', ascending: true }
  });

  const { data: allPromotions } = useSupabaseData({ 
    table: 'promotions',
    select: '*'
  });

  // Fetch client_apps that use referral links
  const { data: clientApps } = useSupabaseData({
    table: 'client_apps',
    select: 'id, client_id, referral_link_id, created_at'
  });

  // Fetch usages for selected referral
  const {
    data: usages,
    isLoading: usagesLoading,
    mutate: mutateUsages
  } = useSupabaseData({
    table: 'referral_link_usages' as any,
    select: '*, clients!client_id(*), client_apps(*, apps(*))',
    match: selectedReferral ? { referral_link_id: selectedReferral.id } : undefined
  });
  

  // Helper function to check if a promotion is currently active (same logic as promotions/app page)
  const isPromotionActive = useMemo(() => {
    return (promo: any): boolean => {
      if (!promo) return false;
      
      // First check the explicit is_active flag
      if (promo.is_active === false) return false;
      if (promo.is_active === true) {
        // If explicitly active, still check dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check start date
        if (promo.start_date) {
          const startDate = new Date(promo.start_date);
          startDate.setHours(0, 0, 0, 0);
          if (today < startDate) return false;
        }
        
        // Check end date
        if (promo.end_date) {
          const endDate = new Date(promo.end_date);
          endDate.setHours(23, 59, 59, 999);
          if (today > endDate) return false;
        }
        
        return true;
      }
      
      // Fallback to date-based logic if is_active is not set
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // If no dates specified, consider it active
      if (!promo.start_date && !promo.end_date) return true;
      
      // Check start date
      if (promo.start_date) {
        const startDate = new Date(promo.start_date);
        startDate.setHours(0, 0, 0, 0);
        if (today < startDate) return false;
      }
      
      // Check end date
      if (promo.end_date) {
        const endDate = new Date(promo.end_date);
        endDate.setHours(23, 59, 59, 999);
        if (today > endDate) return false;
      }
      
      return true;
    };
  }, []);

  // Helper function to check if an app has active promotions
  const appHasActivePromotion = useMemo(() => {
    return (appId: string): boolean => {
      if (!allPromotions || !Array.isArray(allPromotions)) return false;
      const appPromotions = allPromotions.filter((p: any) => p.app_id === appId);
      return appPromotions.some((p: any) => isPromotionActive(p));
    };
  }, [allPromotions, isPromotionActive]);

  // Compute stats for each referral
  const referralsWithStats = useMemo(() => {
    const linksArray = Array.isArray(referralLinks) ? referralLinks : [];
    const clientAppsArray = Array.isArray(clientApps) ? clientApps : [];
    const usagesArray = Array.isArray(allUsages) ? allUsages : [];
    const paymentsArray = Array.isArray(allPayments) ? allPayments : [];
    
    return linksArray.map((link: any): ReferralLinkWithStats & { totalMoney?: number; totalPaid?: number; missingMoney?: number } => {
      // Get stats from client_apps that used this referral
      const clientAppsUsingThis = clientAppsArray.filter(
        (ca: any) => ca.referral_link_id === link.id
      );

      const uniqueClients = new Set(
        clientAppsUsingThis
          .map((ca: any) => ca.client_id)
          .filter(Boolean)
      ).size;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const usesLast7Days = clientAppsUsingThis.filter((ca: any) => {
        const createdAt = new Date(ca.created_at);
        return createdAt >= sevenDaysAgo;
      }).length;

      const usesLast30Days = clientAppsUsingThis.filter((ca: any) => {
        const createdAt = new Date(ca.created_at);
        return createdAt >= thirtyDaysAgo;
      }).length;

      const app = link.apps;
      const owner = link.clients;
      const remaining = link.max_uses ? Math.max(link.max_uses - link.current_uses, 0) : undefined;

      // Determine status: if it's 'redeemed' or 'expired', keep it; otherwise use app/promotion status
      let finalStatus: 'active' | 'inactive' | 'redeemed' | 'expired';
      if (link.status === 'redeemed' || link.status === 'expired') {
        // Keep manual statuses (redeemed/expired)
        finalStatus = link.status;
      } else {
        // For 'active' or 'inactive', check both app.is_active and promotion status
        const appIsActive = app?.is_active !== false; // Default to true if not set
        const hasActivePromo = appHasActivePromotion(link.app_id);
        // Both app and promotion must be active for the referral to be active
        finalStatus = (appIsActive && hasActivePromo) ? 'active' : 'inactive';
      }
      
      // Calculate money: redeemed money / total potential
      const linkUsages = usagesArray.filter((u: any) => u.referral_link_id === link.id);
      const totalUsages = linkUsages.length;
      const redeemedCount = linkUsages.filter((u: any) => u.redeemed).length;
      
      // Get last used date from usages (most recent used_at)
      const lastUsedFromUsages = linkUsages.length > 0 
        ? linkUsages.reduce((latest: string | null, usage: any) => {
            if (!usage.used_at) return latest;
            if (!latest) return usage.used_at;
            return new Date(usage.used_at) > new Date(latest) ? usage.used_at : latest;
          }, null)
        : null;
      
      // Get active promotion for this app
      const appPromotions = Array.isArray(allPromotions) ? allPromotions.filter((p: any) => p.app_id === link.app_id) : [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activePromo = appPromotions.find((p: any) => {
        if (p.is_active === false) return false;
        if (p.is_active === true) {
          const startDate = p.start_date ? new Date(p.start_date) : null;
          const endDate = p.end_date ? new Date(p.end_date) : null;
          if (startDate) startDate.setHours(0, 0, 0, 0);
          if (endDate) endDate.setHours(23, 59, 59, 999);
          if (startDate && today < startDate) return false;
          if (endDate && today > endDate) return false;
          return true;
        }
        const startDate = p.start_date ? new Date(p.start_date) : null;
        const endDate = p.end_date ? new Date(p.end_date) : null;
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);
        if (startDate && today < startDate) return false;
        if (endDate && today > endDate) return false;
        return true;
      }) || appPromotions[0] || null;
      
      const ourReward = activePromo?.our_reward || 0;
      // First number: redeemed money (redeemed uses × reward)
      const redeemedMoney = redeemedCount * Number(ourReward);
      // Second number: total potential (all uses × reward)
      const totalPotential = totalUsages * Number(ourReward);
      
      // Calculate total paid
      const linkPayments = paymentsArray.filter((p: any) => p.referral_link_id === link.id);
      const totalPaid = linkPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const missingMoney = redeemedMoney - totalPaid;
      
      return {
        id: link.id,
        app_id: link.app_id,
        account_name: link.account_name,
        code: link.code,
        url: link.url,
        normalized_url: link.normalized_url,
        status: finalStatus,
        url_validation_status: link.url_validation_status || 'pending',
        current_uses: link.current_uses || 0,
        max_uses: link.max_uses,
        last_used_at: lastUsedFromUsages || link.last_used_at,
        is_active: link.is_active,
        notes: link.notes,
        apps: link.apps,
        owner_client_id: link.owner_client_id,
        clients: link.clients,
        unique_clients: uniqueClients,
        uses_last_7_days: usesLast7Days,
        uses_last_30_days: usesLast30Days,
        redeemedMoney,
        totalPotential,
        totalPaid,
        missingMoney
      };
    });
  }, [referralLinks, clientApps, appHasActivePromotion, allPromotions, allUsages, allPayments]);

  // Group by app
  const referralsByApp = useMemo(() => {
    const grouped = new Map<string, ReferralLinkWithStats[]>();
    
    referralsWithStats.forEach((ref) => {
      const appKey = ref.app_id;
      if (!grouped.has(appKey)) {
        grouped.set(appKey, []);
      }
      grouped.get(appKey)!.push(ref);
    });

    return grouped;
  }, [referralsWithStats]);

  // Get referrals for selected app, grouped by account
  const referralsByAccount = useMemo(() => {
    if (!selectedAppId) return new Map<string, ReferralLinkWithStats[]>();
    
    const appReferrals = referralsWithStats.filter((ref) => {
      if (ref.app_id !== selectedAppId) return false;
      if (accountFilter !== 'all' && (ref.account_name || 'No Account') !== accountFilter) return false;
      if (statusFilter !== 'all' && ref.status !== statusFilter) return false;
      if (validationFilter !== 'all' && ref.url_validation_status !== validationFilter) return false;
      return true;
    });

    const grouped = new Map<string, ReferralLinkWithStats[]>();
    appReferrals.forEach((ref) => {
      const accountKey = ref.account_name || 'No Account';
      if (!grouped.has(accountKey)) {
        grouped.set(accountKey, []);
      }
      grouped.get(accountKey)!.push(ref);
    });

    // Sort each account group: active status first, then by usage (most used first)
    grouped.forEach((refs) => {
      refs.sort((a, b) => {
        // First priority: active status
        const aIsActive = a.status === 'active';
        const bIsActive = b.status === 'active';
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        // Second priority: usage count (most used first)
        return b.current_uses - a.current_uses;
      });
    });

    return grouped;
  }, [referralsWithStats, selectedAppId, accountFilter, statusFilter, validationFilter]);

  // Get unique accounts for filter
  const uniqueAccounts = useMemo(() => {
    if (!selectedAppId) return [];
    const accounts = new Set<string>();
    referralsWithStats
      .filter((ref) => ref.app_id === selectedAppId)
      .forEach((ref) => {
        if (ref.account_name) {
          accounts.add(ref.account_name);
        }
      });
    return Array.from(accounts).sort();
  }, [referralsWithStats, selectedAppId]);

  const selectedApp = Array.isArray(apps) ? apps.find((app: any) => app.id === selectedAppId) : null;

  // Filter apps based on search
  const filteredApps = useMemo(() => {
    if (!Array.isArray(apps)) return [];
    if (!appSearchFilter.trim()) return apps;
    
    const searchLower = appSearchFilter.toLowerCase().trim();
    return apps.filter((app: any) => 
      app.name?.toLowerCase().includes(searchLower)
    );
  }, [apps, appSearchFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#94a3b8';
      case 'redeemed': return '#3b82f6';
      case 'expired': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getValidationColor = (status: string) => {
    switch (status) {
      case 'valid': return '#10b981';
      case 'invalid': return '#ef4444';
      case 'needs_review': return '#f59e0b';
      case 'pending': return '#94a3b8';
      default: return '#64748b';
    }
  };

  const getCardColor = (ref: ReferralLinkWithStats) => {
    if (ref.current_uses === 0) return { bg: '#fef3c7', border: '#f59e0b' }; // Never used - yellow
    if (ref.status === 'redeemed') return { bg: '#dbeafe', border: '#3b82f6' }; // Fully redeemed - blue
    if (ref.url_validation_status === 'invalid') return { bg: '#fee2e2', border: '#ef4444' }; // Invalid URL - red
    return { bg: '#f0fdf4', border: '#10b981' }; // Active - green
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Referral links" description="Loading referral links..." />
        <LoadingSpinner message="Loading referral links..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Referral links" description="Error loading referral links" />
        <ErrorMessage error={error} onRetry={mutate} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Referral links"
        description={
          isDemo
            ? 'Showing interactive demo data. Provide Supabase environment variables to load production records.'
            : 'Track referral links by app, account, and usage statistics. Click a card to see detailed usage history. "Redeemed" status means the referral link has been fully used (reached max_uses) or manually marked as completed.'
        }
      />

      {!selectedAppId ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
              Available Apps
            </h2>
            <input
              type="text"
              value={appSearchFilter}
              onChange={(e) => setAppSearchFilter(e.target.value)}
              placeholder="Search apps..."
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
                width: '300px',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            />
          </div>
          {Array.isArray(apps) && apps.length === 0 ? (
            <EmptyState
              title="No apps found"
              message="No apps with referral links available."
            />
          ) : filteredApps.length === 0 ? (
            <EmptyState
              title="No apps found"
              message={`No apps match "${appSearchFilter}".`}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {filteredApps.map((app: any) => {
                const appReferrals = referralsByApp.get(app.id) || [];
                const totalUses = appReferrals.reduce((sum, ref) => sum + ref.current_uses, 0);
                // Check if app is active: app.is_active must be true AND must have active promotions
                const appIsActive = app.is_active !== false; // Default to true if not set
                const hasActivePromo = appHasActivePromotion(app.id);
                const hasActive = appIsActive && hasActivePromo;
                
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    style={{
                      backgroundColor: hasActive ? '#f0fdf4' : '#f8fafc',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: `2px solid ${hasActive ? '#10b981' : '#e2e8f0'}`,
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    <strong style={{ 
                      color: hasActive ? '#065f46' : '#475569', 
                      fontSize: '1rem',
                      display: 'block',
                      marginBottom: '0.5rem'
                    }}>
              {app.name}
                    </strong>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: hasActive ? '#10b981' : '#94a3b8',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      {hasActive ? '● Active' : '○ Inactive'}
                    </span>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                      {appReferrals.length} referral{appReferrals.length !== 1 ? 's' : ''} • {totalUses} uses
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <button
              onClick={() => {
                setSelectedAppId(null);
                setAccountFilter('all');
                setStatusFilter('all');
                setValidationFilter('all');
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#64748b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              ← Back to Apps
            </button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
              {selectedApp?.name} - Referral Links
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setMarkAllRedeemedModal({ isOpen: true })}
                disabled={isMarkingAllRedeemed}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: isMarkingAllRedeemed ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isMarkingAllRedeemed ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  opacity: isMarkingAllRedeemed ? 0.6 : 1
                }}
              >
                {isMarkingAllRedeemed ? 'Marking...' : 'Mark All as Redeemed'}
              </button>
              <button
                onClick={() => {
                  setEditingReferral(null);
                  setShowEditModal(true);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                + Add Referral Link
              </button>
            </div>
          </div>

      <FiltersBar>
            {uniqueAccounts.length > 0 && (
              <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
                <option value="all">All accounts</option>
                {uniqueAccounts.map((account) => (
                  <option key={account} value={account}>
                    {account}
            </option>
          ))}
        </select>
            )}
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
          <option value="inactive">Inactive</option>
              <option value="redeemed">Redeemed</option>
              <option value="expired">Expired</option>
            </select>
            <select value={validationFilter} onChange={(event) => setValidationFilter(event.target.value)}>
              <option value="all">All URL status</option>
              <option value="valid">Valid</option>
              <option value="invalid">Invalid</option>
              <option value="needs_review">Needs Review</option>
              <option value="pending">Pending</option>
        </select>
      </FiltersBar>

          {referralsByAccount.size === 0 ? (
        <EmptyState
          title="No referral links found"
          message={
                accountFilter !== 'all' || statusFilter !== 'all' || validationFilter !== 'all'
              ? 'No referral links match your current filters.'
                  : `No referral links available for ${selectedApp?.name}.`
          }
        />
      ) : (
            <div style={{ marginTop: '1.5rem' }}>
              {Array.from(referralsByAccount.entries())
                .sort(([accountA, refsA], [accountB, refsB]) => {
                  // Sort accounts: those with active referrals first
                  const hasActiveA = refsA.some((ref) => ref.status === 'active');
                  const hasActiveB = refsB.some((ref) => ref.status === 'active');
                  if (hasActiveA && !hasActiveB) return -1;
                  if (!hasActiveA && hasActiveB) return 1;
                  // If both have or don't have active, sort alphabetically
                  return accountA.localeCompare(accountB);
                })
                .map(([account, accountReferrals]) => {
                const rows = accountReferrals.map((ref) => {
                  const remaining = ref.max_uses ? ref.max_uses - ref.current_uses : null;
                  const isLowRemaining = remaining !== null && remaining < 3 && remaining > 0;
                  const isAvailable = remaining === null || remaining > 0;
                  const refWithMoney = ref as any;
                  const redeemedMoney = Number(refWithMoney.redeemedMoney) || 0;
                  const totalPotential = Number(refWithMoney.totalPotential) || 0;
                  
                  // Ensure we always show the format, even if both are 0
                  const moneyDisplay = `€${redeemedMoney.toFixed(2)} / €${totalPotential.toFixed(2)}`;
                  
                  return {
                    id: ref.id,
                    account: ref.account_name || 'No Account',
                    code: ref.code || '—',
                    link: ref.normalized_url || ref.url,
                    remaining: remaining !== null ? remaining : '∞',
                    max_uses: ref.max_uses || '∞',
                    current_uses: ref.current_uses,
                    status: ref.status,
                    last_used: ref.last_used_at 
                      ? new Date(ref.last_used_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : 'Never',
                    money: moneyDisplay,
                    isAvailable,
                    isLowRemaining,
                    referral: ref
                  } as any;
                });

                return (
                  <div key={account} style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#1e293b' }}>
                      {account}
                      <span style={{ fontSize: '0.8rem', fontWeight: '400', color: '#64748b', marginLeft: '0.5rem' }}>
                        ({accountReferrals.length})
                      </span>
                    </h3>
        <DataTable
                      data={rows}
        columns={[
          {
                          key: 'code',
                          header: 'Code',
            render: (row) => (
                            <div style={{ fontWeight: '600', color: '#334155' }}>
                              {row.code}
                            </div>
                          )
                        },
                        {
                          key: 'link',
                          header: 'Link',
                          render: (row) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <a
                                href={row.link}
                                target="_blank"
                                rel="noreferrer"
                                style={{ 
                                  color: '#2563eb', 
                                  textDecoration: 'none',
                                  fontSize: '0.875rem',
                                  wordBreak: 'break-all',
                                  flex: 1,
                                  minWidth: '200px'
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = 'none';
                                }}
                              >
                                {row.link}
                              </a>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  
                                  try {
                                    // Fallback method for older browsers
                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                      await navigator.clipboard.writeText(row.link);
                                    } else {
                                      // Fallback: create temporary textarea
                                      const textarea = document.createElement('textarea');
                                      textarea.value = row.link;
                                      textarea.style.position = 'fixed';
                                      textarea.style.opacity = '0';
                                      document.body.appendChild(textarea);
                                      textarea.select();
                                      document.execCommand('copy');
                                      document.body.removeChild(textarea);
                                    }
                                    
                                    // Set copied state for visual feedback
                                    setCopiedLinkId(row.id);
                                    setTimeout(() => {
                                      setCopiedLinkId(null);
                                    }, 2000);
                                  } catch (err) {
                                    console.error('Failed to copy:', err);
                                    // Try fallback method
                                    try {
                                      const textarea = document.createElement('textarea');
                                      textarea.value = row.link;
                                      textarea.style.position = 'fixed';
                                      textarea.style.opacity = '0';
                                      document.body.appendChild(textarea);
                                      textarea.select();
                                      document.execCommand('copy');
                                      document.body.removeChild(textarea);
                                      setCopiedLinkId(row.id);
                                      setTimeout(() => {
                                        setCopiedLinkId(null);
                                      }, 2000);
                                    } catch (fallbackErr) {
                                      console.error('Fallback copy failed:', fallbackErr);
                                      alert('Failed to copy to clipboard. Please copy manually: ' + row.link);
                                    }
                                  }
                                }}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  fontSize: '0.875rem',
                                  background: copiedLinkId === row.id ? '#10b981' : '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: '500',
                                  transition: 'background-color 0.2s',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                  if (copiedLinkId !== row.id) {
                                    e.currentTarget.style.backgroundColor = '#2563eb';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (copiedLinkId !== row.id) {
                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                  }
                                }}
                              >
                                {copiedLinkId === row.id ? '✓ Copied!' : 'Copy'}
                              </button>
                            </div>
                          )
                        },
                        {
                          key: 'remaining',
                          header: 'Remaining',
            render: (row) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ 
                                fontSize: '1.25rem', 
                                fontWeight: '700', 
                                color: row.isAvailable ? (row.isLowRemaining ? '#f59e0b' : '#10b981') : '#ef4444'
                              }}>
                                {row.remaining}
                  </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                / {row.max_uses}
                              </div>
              </div>
            )
          },
          {
            key: 'current_uses',
                          header: 'Used',
                          render: (row) => (
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                              {row.current_uses}
                            </div>
                          )
                        },
                        {
                          key: 'status',
            header: 'Status',
                          render: (row) => (
                            <span
                              style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                backgroundColor: getStatusColor(row.status),
                                color: 'white'
                              }}
                            >
                              {row.status}
                            </span>
                          )
                        },
                        {
                          key: 'money',
                          header: 'Money',
                          render: (row) => (
                            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#065f46' }}>
                              {row.money}
                            </div>
                          )
                        },
                        {
                          key: 'last_used',
                          header: 'Last Used',
                          render: (row) => (
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                              {row.last_used || 'Never'}
                            </div>
                          )
                        },
                        {
                          key: 'actions',
                          header: 'Actions',
                          render: (row) => (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingReferral(row.referral);
                                  setShowEditModal(true);
                                }}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  fontSize: '0.875rem',
                                  background: '#64748b',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: '500'
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          )
                        }
                      ]}
                      renderRow={(row, index) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedReferral(row.referral)}
                          style={{
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '';
                          }}
                        >
                          <td style={{ fontWeight: '600', color: '#334155' }}>{row.code}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <a
                                href={row.link}
                                target="_blank"
                                rel="noreferrer"
                                style={{ 
                                  color: '#2563eb', 
                                  textDecoration: 'none',
                                  fontSize: '0.875rem',
                                  wordBreak: 'break-all',
                                  flex: 1,
                                  minWidth: '200px'
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = 'none';
                                }}
                              >
                                {row.link}
                              </a>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  
                                  try {
                                    // Fallback method for older browsers
                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                      await navigator.clipboard.writeText(row.link);
                                    } else {
                                      // Fallback: create temporary textarea
                                      const textarea = document.createElement('textarea');
                                      textarea.value = row.link;
                                      textarea.style.position = 'fixed';
                                      textarea.style.opacity = '0';
                                      document.body.appendChild(textarea);
                                      textarea.select();
                                      document.execCommand('copy');
                                      document.body.removeChild(textarea);
                                    }
                                    
                                    // Set copied state for visual feedback
                                    setCopiedLinkId(row.id);
                                    setTimeout(() => {
                                      setCopiedLinkId(null);
                                    }, 2000);
                                  } catch (err) {
                                    console.error('Failed to copy:', err);
                                    // Try fallback method
                                    try {
                                      const textarea = document.createElement('textarea');
                                      textarea.value = row.link;
                                      textarea.style.position = 'fixed';
                                      textarea.style.opacity = '0';
                                      document.body.appendChild(textarea);
                                      textarea.select();
                                      document.execCommand('copy');
                                      document.body.removeChild(textarea);
                                      setCopiedLinkId(row.id);
                                      setTimeout(() => {
                                        setCopiedLinkId(null);
                                      }, 2000);
                                    } catch (fallbackErr) {
                                      console.error('Fallback copy failed:', fallbackErr);
                                      alert('Failed to copy to clipboard. Please copy manually: ' + row.link);
                                    }
                                  }
                                }}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  fontSize: '0.875rem',
                                  background: copiedLinkId === row.id ? '#10b981' : '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: '500',
                                  transition: 'background-color 0.2s',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                  if (copiedLinkId !== row.id) {
                                    e.currentTarget.style.backgroundColor = '#2563eb';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (copiedLinkId !== row.id) {
                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                  }
                                }}
                              >
                                {copiedLinkId === row.id ? '✓ Copied!' : 'Copy'}
                              </button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ 
                                fontSize: '1.25rem', 
                                fontWeight: '700', 
                                color: row.isAvailable ? (row.isLowRemaining ? '#f59e0b' : '#10b981') : '#ef4444'
                              }}>
                                {row.remaining}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                / {row.max_uses}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.875rem', color: '#64748b' }}>{row.current_uses}</td>
                          <td>
                            <span
                              style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                backgroundColor: getStatusColor(row.status),
                                color: 'white'
                              }}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.875rem', fontWeight: '600', color: '#065f46' }}>{row.money}</td>
                          <td style={{ fontSize: '0.875rem', color: '#64748b' }}>{row.last_used || 'Never'}</td>
                          <td style={{ textAlign: 'left' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingReferral(row.referral);
                                setShowEditModal(true);
                              }}
                              style={{
                                padding: '0.375rem 0.75rem',
                                fontSize: '0.875rem',
                                background: '#64748b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500'
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedReferral && (
        <ReferralDetailModal
          referral={selectedReferral}
          usages={(usages as ReferralLinkUsage[]) || []}
          onClose={() => setSelectedReferral(null)}
          onUsageUpdate={() => {
            // Refresh usages data
            mutateUsages();
            // Also refresh referral links to update stats
            mutate();
          }}
        />
      )}

      {showEditModal && (
        <ReferralEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingReferral(null);
          }}
          referral={editingReferral}
          appId={selectedAppId}
          onSave={() => {
            mutate();
            setShowEditModal(false);
            setEditingReferral(null);
          }}
        />
      )}

      {/* Mark All as Redeemed Modal */}
      <ConfirmationModal
        isOpen={markAllRedeemedModal.isOpen}
        title="Mark All Referral Links as Redeemed?"
        message="Are you sure you want to mark all referral links for this app as 'Redeemed'? This will set their status to 'redeemed'. You can change them back to 'active' or 'inactive' later by editing individual referral links."
        confirmLabel="Mark All as Redeemed"
        cancelLabel="Cancel"
        onConfirm={async () => {
          if (!selectedAppId) return;
          
          setIsMarkingAllRedeemed(true);
          try {
            const supabase = getSupabaseClient();
            if (!supabase) {
              throw new Error('Supabase client not initialized');
            }

            // Get all referral links for the selected app
            const { data: allAppReferrals, error: fetchError } = await (supabase as any)
              .from('referral_links')
              .select('id')
              .eq('app_id', selectedAppId);

            if (fetchError) throw fetchError;

            if (allAppReferrals && allAppReferrals.length > 0) {
              // Update all referral links to 'redeemed' status
              const { error: updateError } = await (supabase as any)
                .from('referral_links')
                .update({ status: 'redeemed' })
                .eq('app_id', selectedAppId);

              if (updateError) throw updateError;

              await mutate();
              setMarkAllRedeemedModal({ isOpen: false });
            } else {
              setMarkAllRedeemedModal({ isOpen: false });
            }
          } catch (error) {
            console.error('Failed to mark all as redeemed:', error);
            alert('Failed to mark all referral links as redeemed. Please try again.');
          } finally {
            setIsMarkingAllRedeemed(false);
          }
        }}
        onCancel={() => setMarkAllRedeemedModal({ isOpen: false })}
        variant="info"
      />
    </div>
  );
}
