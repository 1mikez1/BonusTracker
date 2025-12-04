'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { SectionHeader } from '@/components/SectionHeader';
import { FiltersBar } from '@/components/FiltersBar';
import { DataTable } from '@/components/DataTable';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Toast } from '@/components/Toast';

// User options for filtering (excluding 'io')
const USER_OPTIONS = ['Luna', 'Marco', 'Jacopo'];

export default function DebtsPage() {
  const {
    data: referralDebts,
    isLoading: referralDebtsLoading,
    error: referralDebtsError,
    mutate: mutateReferralDebts,
    isDemo
  } = useSupabaseData({
    table: 'referral_link_debts',
    select: '*, referral_links(*, apps(*))'
  });
  
  const {
    data: depositDebts,
    isLoading: depositDebtsLoading,
    error: depositDebtsError,
    mutate: mutateDepositDebts,
  } = useSupabaseData({
    table: 'deposit_debts' as any,
    select: '*, client_apps(*, apps(*))'
  });

  // Fetch debt payments for partial payment tracking
  const {
    data: debtPayments,
    isLoading: debtPaymentsLoading,
    mutate: mutateDebtPayments,
  } = useSupabaseData({
    table: 'debt_payments' as any,
    select: '*'
  });
  
  // Fetch all clients separately to avoid relationship ambiguity
  const {
    data: allClients,
    isLoading: clientsLoading,
    error: clientsError
  } = useSupabaseData({
    table: 'clients',
    select: 'id, name, surname'
  });

  // Fetch referral links with owners for "payments to receive" section
  const {
    data: referralLinks,
    isLoading: referralLinksLoading,
  } = useSupabaseData({
    table: 'referral_links',
    select: '*, apps(*), owner_client_id'
  });
  
  const isLoading = referralDebtsLoading || depositDebtsLoading || clientsLoading || debtPaymentsLoading || referralLinksLoading;
  const error = referralDebtsError || depositDebtsError || clientsError;
  const { mutate: updateReferralDebt } = useSupabaseMutations('referral_link_debts');
  const { mutate: updateDepositDebt } = useSupabaseMutations('deposit_debts' as any);
  const { insert: insertDebtPayment, remove: deleteDebtPayment, mutate: updateDebtPayment } = useSupabaseMutations('debt_payments' as any, undefined, mutateDebtPayments);
  const { insert: insertReferralDebt } = useSupabaseMutations('referral_link_debts', undefined, mutateReferralDebts);
  const { insert: insertDepositDebt } = useSupabaseMutations('deposit_debts' as any, undefined, mutateDepositDebts);

  const [statusFilter, setStatusFilter] = useState('all');
  const [creditorFilter, setCreditorFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Modals
  const [settleDebtModal, setSettleDebtModal] = useState<{ isOpen: boolean; debt: any | null }>({
    isOpen: false,
    debt: null
  });
  const [partialPaymentModal, setPartialPaymentModal] = useState<{ isOpen: boolean; debt: any | null }>({
    isOpen: false,
    debt: null
  });
  const [newDebtModal, setNewDebtModal] = useState<{ isOpen: boolean }>({
    isOpen: false
  });
  const [debtDetailModal, setDebtDetailModal] = useState<{ isOpen: boolean; debt: any | null }>({
    isOpen: false,
    debt: null
  });
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editDebtAmount, setEditDebtAmount] = useState('');
  const [editDebtDescription, setEditDebtDescription] = useState('');
  const [isSavingDebtEdit, setIsSavingDebtEdit] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentPaidTo, setEditPaymentPaidTo] = useState('');
  const [editPaymentNotes, setEditPaymentNotes] = useState('');
  const [isSavingPaymentEdit, setIsSavingPaymentEdit] = useState(false);
  const [deletePaymentModal, setDeletePaymentModal] = useState<{ isOpen: boolean; paymentId: string | null }>({
    isOpen: false,
    paymentId: null
  });
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  // New debt form state
  const [newDebtType, setNewDebtType] = useState<'referral' | 'deposit'>('deposit');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  // Removed newDebtSurplus - surplus is calculated dynamically from payments
  const [newDebtClientId, setNewDebtClientId] = useState('');
  const [newDebtAppId, setNewDebtAppId] = useState('');
  const [newDebtDescription, setNewDebtDescription] = useState('');
  const [newDebtAssignedTo, setNewDebtAssignedTo] = useState('');
  const [newDebtReferralLinkId, setNewDebtReferralLinkId] = useState('');
  const [newDebtCreditorId, setNewDebtCreditorId] = useState('');
  const [isSubmittingNewDebt, setIsSubmittingNewDebt] = useState(false);

  // Partial payment form state
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [partialPaymentNotes, setPartialPaymentNotes] = useState('');
  const [partialPaymentPaidTo, setPartialPaymentPaidTo] = useState('');
  const [partialPaymentPaidToSearch, setPartialPaymentPaidToSearch] = useState('');
  const [showPaidToDropdown, setShowPaidToDropdown] = useState(false);
  const [isSubmittingPartialPayment, setIsSubmittingPartialPayment] = useState(false);

  // Client search for new debt
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  
  // Paid To search refs
  const paidToInputRef = useRef<HTMLInputElement>(null);
  const paidToDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch apps for new debt
  const {
    data: allApps,
    isLoading: appsLoading
  } = useSupabaseData({
    table: 'apps',
    select: 'id, name'
  });

  const rows = useMemo(() => {
    const referralDebtsArray = Array.isArray(referralDebts) ? referralDebts : [];
    const depositDebtsArray = Array.isArray(depositDebts) ? depositDebts : [];
    const clientsArray = Array.isArray(allClients) ? allClients : [];
    const paymentsArray = Array.isArray(debtPayments) ? debtPayments : [];
    
    // Map referral link debts
    const referralRows = referralDebtsArray.map((debt: any) => {
      const creditor = clientsArray.find((c: any) => c.id === debt?.creditor_client_id);
      const debtor = debt?.debtor_client_id 
        ? clientsArray.find((c: any) => c.id === debt?.debtor_client_id)
        : null;
      const link = debt?.referral_links;
      const app = link?.apps;
      
      // Calculate payments for this debt
      const debtPaymentsForDebt = paymentsArray.filter((p: any) => 
        p.debt_type === 'referral' && p.debt_id === debt.id
      );
      const totalPaid = debtPaymentsForDebt.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const remaining = Number(debt.amount || 0) - totalPaid;
      
      return {
        ...debt,
        debtType: 'referral',
        creditorName: creditor ? `${creditor.name} ${creditor.surname ?? ''}`.trim() : debt?.creditor_client_id || 'Unknown',
        debtorName: debtor ? `${debtor.name} ${debtor.surname ?? ''}`.trim() : '—',
        linkUrl: link?.url ?? '—',
        appName: app?.name ?? '—',
        description: debt?.description || 'Referral link debt',
        paidAmount: totalPaid,
        remainingAmount: remaining,
        payments: debtPaymentsForDebt,
        assigned_to: null // referral_link_debts doesn't have assigned_to field
      };
    });
    
    // Map deposit debts
    const depositRows = depositDebtsArray.map((debt: any) => {
      const client = clientsArray.find((c: any) => c.id === debt?.client_id);
      const clientApp = debt?.client_apps;
      const app = clientApp?.apps;
      
      // Calculate payments for this debt
      const debtPaymentsForDebt = paymentsArray.filter((p: any) => 
        p.debt_type === 'deposit' && p.debt_id === debt.id
      );
      const totalPaid = debtPaymentsForDebt.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const baseAmount = Number(debt.amount || 0);
      // Surplus is calculated dynamically: if payments exceed original amount, the excess is surplus
      const calculatedSurplus = Math.max(0, totalPaid - baseAmount);
      // Total debt amount = original amount + calculated surplus (from overpayments)
      const totalAmount = baseAmount + calculatedSurplus;
      // Remaining: if paid >= baseAmount, remaining is 0 (debt is fully paid, surplus is extra)
      // Otherwise, remaining = baseAmount - totalPaid (still owe the difference)
      const remaining = totalPaid >= baseAmount ? 0 : (baseAmount - totalPaid);
      
      return {
        ...debt,
        debtType: 'deposit',
        creditorName: 'Us',
        debtorName: client ? `${client.name} ${client.surname ?? ''}`.trim() : debt?.client_id || 'Unknown',
        linkUrl: app?.name ? `${app.name} deposit` : '—',
        appName: app?.name ?? '—',
        description: debt?.deposit_source || debt?.description || `Deposit for ${app?.name || 'app'}`,
        paidAmount: totalPaid,
        remainingAmount: remaining,
        totalAmount: totalAmount, // Include total amount (amount + calculated surplus) for display
        surplus: calculatedSurplus, // Calculated surplus (from overpayments)
        payments: debtPaymentsForDebt,
        assigned_to: debt?.deposit_source || null // Use deposit_source as assigned_to for deposit_debts
      };
    });
    
    // Combine and sort by created_at (newest first)
    return [...referralRows, ...depositRows].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [referralDebts, depositDebts, allClients, debtPayments]);

  // Calculate "payments to receive" from referral link owners
  const paymentsToReceive = useMemo(() => {
    const referralLinksArray = Array.isArray(referralLinks) ? referralLinks : [];
    const referralDebtsArray = Array.isArray(referralDebts) ? referralDebts : [];
    const clientsArray = Array.isArray(allClients) ? allClients : [];
    
    // Group debts by referral link owner
    const ownerDebtsMap = new Map<string, any[]>();
    
    referralDebtsArray.forEach((debt: any) => {
      const link = debt?.referral_links;
      if (link?.owner_client_id) {
        const ownerId = link.owner_client_id;
        if (!ownerDebtsMap.has(ownerId)) {
          ownerDebtsMap.set(ownerId, []);
        }
        ownerDebtsMap.get(ownerId)!.push(debt);
      }
    });
    
    // Calculate totals per owner
    return Array.from(ownerDebtsMap.entries()).map(([ownerId, debts]) => {
      const owner = clientsArray.find((c: any) => c.id === ownerId);
      const totalAmount = debts.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const totalPaid = debts.reduce((sum, d) => {
        const debtPaymentsForDebt = Array.isArray(debtPayments) ? debtPayments.filter((p: any) => 
          p.debt_type === 'referral' && p.debt_id === d.id
        ) : [];
        return sum + debtPaymentsForDebt.reduce((pSum: number, p: any) => pSum + Number(p.amount || 0), 0);
      }, 0);
      
      return {
        ownerId,
        ownerName: owner ? `${owner.name} ${owner.surname ?? ''}`.trim() : ownerId,
        totalAmount,
        totalPaid,
        remaining: totalAmount - totalPaid,
        debts
      };
    });
  }, [referralLinks, referralDebts, allClients, debtPayments]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Map deposit_debts status 'paid_back' to 'settled' for filtering
      const displayStatus = row.status === 'paid_back' ? 'settled' : row.status;
      
      if (statusFilter !== 'all' && displayStatus !== statusFilter) {
        return false;
      }
      if (creditorFilter !== 'all') {
        if (creditorFilter === 'us') {
          // Show only deposit debts (creditor is "Us")
          if (row.debtType !== 'deposit') {
            return false;
          }
        } else {
          // Show only referral debts with matching creditor
          if (row.debtType !== 'referral' || row.creditor_client_id !== creditorFilter) {
            return false;
          }
        }
      }
      if (userFilter !== 'all') {
        // Filter by assigned_to field (case-insensitive)
        const assignedTo = (row.assigned_to || '').toLowerCase();
        if (assignedTo !== userFilter.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, creditorFilter, userFilter]);

  // Paginate filtered rows
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, creditorFilter, userFilter]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target as Node) &&
        clientInputRef.current &&
        !clientInputRef.current.contains(event.target as Node)
      ) {
        setShowClientDropdown(false);
      }
      if (
        paidToDropdownRef.current &&
        !paidToDropdownRef.current.contains(event.target as Node) &&
        paidToInputRef.current &&
        !paidToInputRef.current.contains(event.target as Node)
      ) {
        setShowPaidToDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter clients for dropdown
  const filteredClients = useMemo(() => {
    const clientsArray = Array.isArray(allClients) ? allClients : [];
    if (!clientSearch.trim()) return clientsArray.slice(0, 10);
    const searchLower = clientSearch.toLowerCase();
    return clientsArray
      .filter((c: any) => {
        const fullName = `${c.name} ${c.surname || ''}`.trim().toLowerCase();
        return fullName.includes(searchLower);
      })
      .slice(0, 10);
  }, [allClients, clientSearch]);

  // Filter users for "Paid To" dropdown
  const filteredPaidToUsers = useMemo(() => {
    if (!partialPaymentPaidToSearch.trim()) {
      return USER_OPTIONS.map(u => ({ name: u, isNew: false }));
    }
    const searchLower = partialPaymentPaidToSearch.toLowerCase();
    const matching = USER_OPTIONS.filter(u => u.toLowerCase().includes(searchLower));
    const exactMatch = USER_OPTIONS.find(u => u.toLowerCase() === searchLower);
    
    // If no exact match, show option to create new
    if (!exactMatch && partialPaymentPaidToSearch.trim()) {
      return [
        ...matching.map(u => ({ name: u, isNew: false })),
        { name: partialPaymentPaidToSearch.trim(), isNew: true }
      ];
    }
    return matching.map(u => ({ name: u, isNew: false }));
  }, [partialPaymentPaidToSearch]);

  const handleSettleDebtClick = (debt: any) => {
    if (isDemo) {
      setToast({
        isOpen: true,
        message: 'Settlement is disabled in demo mode. Connect Supabase to enable this feature.',
        type: 'info'
      });
      return;
    }
    setSettleDebtModal({ isOpen: true, debt });
  };

  const handlePartialPaymentClick = (debt: any) => {
    if (isDemo) {
      setToast({
        isOpen: true,
        message: 'Partial payments are disabled in demo mode. Connect Supabase to enable this feature.',
        type: 'info'
      });
      return;
    }
    setPartialPaymentModal({ isOpen: true, debt });
    setPartialPaymentAmount('');
    setPartialPaymentNotes('');
    setPartialPaymentPaidTo('');
    setPartialPaymentPaidToSearch('');
  };

  const handleSettleDebtConfirm = async () => {
    if (!settleDebtModal.debt) return;

    const debt = settleDebtModal.debt;
    
    try {
      // For full settlement, add a payment equal to remaining amount
      // For deposit debts, include surplus in the calculation
      let remaining = debt.remainingAmount;
      if (!remaining) {
        const baseAmount = Number(debt.amount || 0);
        const paidAmount = Number(debt.paidAmount || 0);
        // Surplus is calculated dynamically: if payments exceed original amount, the excess is surplus
        const calculatedSurplus = debt.debtType === 'deposit' 
          ? Math.max(0, paidAmount - baseAmount)
          : 0;
        const totalAmount = baseAmount + calculatedSurplus;
        remaining = totalAmount - paidAmount;
      }
      
      if (remaining > 0) {
        await insertDebtPayment({
          debt_type: debt.debtType,
          debt_id: debt.id,
          amount: remaining,
          payment_date: new Date().toISOString(),
          notes: 'Full settlement',
          created_by: 'system'
        });
      }
      
      await mutateReferralDebts();
      await mutateDepositDebts();
      await mutateDebtPayments();
      
      setSettleDebtModal({ isOpen: false, debt: null });
      setToast({
        isOpen: true,
        message: debt.debtType === 'deposit' ? 'Deposit marked as paid back.' : 'Debt marked as settled.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to settle debt:', error);
      setSettleDebtModal({ isOpen: false, debt: null });
      setToast({
        isOpen: true,
        message: 'Failed to settle debt. Please try again.',
        type: 'error'
      });
    }
  };

  const handlePartialPaymentConfirm = async () => {
    if (!partialPaymentModal.debt) return;

    const debt = partialPaymentModal.debt;
    const amount = parseFloat(partialPaymentAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setToast({
        isOpen: true,
        message: 'Please enter a valid payment amount.',
        type: 'error'
      });
      return;
    }

    if (!partialPaymentPaidTo || !partialPaymentPaidTo.trim()) {
      setToast({
        isOpen: true,
        message: 'Please specify who receives this payment.',
        type: 'error'
      });
      return;
    }

    // For deposit debts, allow paying any amount (including more than original)
    // Surplus is calculated dynamically: if payments exceed original amount, the excess is surplus
    const baseAmount = Number(debt.amount || 0);
    const paidAmount = Number(debt.paidAmount || 0);
    const calculatedSurplus = debt.debtType === 'deposit' 
      ? Math.max(0, paidAmount - baseAmount)
      : 0;
    // Prefer totalAmount if it exists (already calculated with surplus), otherwise calculate
    const totalAmount = debt.totalAmount 
      ? Number(debt.totalAmount) 
      : (baseAmount + calculatedSurplus);
    // Remaining: if paid >= baseAmount, remaining is 0 (debt is fully paid, surplus is extra)
    // Otherwise, remaining = baseAmount - paidAmount (still owe the difference)
    const remaining = paidAmount >= baseAmount ? 0 : (baseAmount - paidAmount);
    
    // Check debtType explicitly - it should be 'deposit' or 'referral'
    // If debtType is not set, try to infer it from the debt structure
    // Deposit debts have 'deposit_source' or come from 'deposit_debts' table
    // Referral debts have 'creditor_client_id' or come from 'referral_link_debts' table
    let debtType = debt.debtType;
    if (!debtType) {
      // Try to infer from debt structure
      if (debt.deposit_source !== undefined || debt.client_id !== undefined) {
        debtType = 'deposit';
      } else if (debt.creditor_client_id !== undefined || debt.referral_link_id !== undefined) {
        debtType = 'referral';
      }
    }
    
    const isDepositDebt = debtType === 'deposit';
    const isReferralDebt = debtType === 'referral';
    
    // Debug log to see what's happening
    console.log('Payment validation debug:', {
      originalDebtType: debt.debtType,
      inferredDebtType: debtType,
      isDepositDebt,
      isReferralDebt,
      amount,
      remaining,
      baseAmount,
      paidAmount,
      calculatedSurplus,
      debtKeys: Object.keys(debt)
    });
    
    // ONLY validate for referral debts - deposit debts can have unlimited payments
    // If we can't determine the type, default to allowing the payment (safer)
    if (isReferralDebt && amount > remaining) {
      setToast({
        isOpen: true,
        message: `Payment amount cannot exceed remaining amount (€${remaining.toFixed(2)}).`,
        type: 'error'
      });
      return;
    }
    
    // For deposit debts (or unknown type), NO validation - allow any payment amount
    // If payment exceeds remaining, it will create surplus automatically
    
    setIsSubmittingPartialPayment(true);
    
    try {
      await insertDebtPayment({
        debt_type: debt.debtType,
        debt_id: debt.id,
        amount: amount,
        payment_date: new Date().toISOString(),
        notes: partialPaymentNotes || null,
        created_by: partialPaymentPaidTo || null
      });
      
      await mutateReferralDebts();
      await mutateDepositDebts();
      await mutateDebtPayments();
      
      setPartialPaymentModal({ isOpen: false, debt: null });
      setPartialPaymentAmount('');
      setPartialPaymentNotes('');
      setPartialPaymentPaidTo('');
      setPartialPaymentPaidToSearch('');
      setToast({
        isOpen: true,
        message: 'Partial payment recorded successfully.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to record partial payment:', error);
      setToast({
        isOpen: true,
        message: 'Failed to record partial payment. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSubmittingPartialPayment(false);
    }
  };

  const handleNewDebtSubmit = async () => {
    if (!newDebtAmount || parseFloat(newDebtAmount) <= 0) {
      setToast({
        isOpen: true,
        message: 'Please enter a valid amount.',
        type: 'error'
      });
      return;
    }

    setIsSubmittingNewDebt(true);
    
    try {
      if (newDebtType === 'deposit') {
        if (!newDebtClientId) {
          setToast({
            isOpen: true,
            message: 'Please select a client.',
            type: 'error'
          });
          setIsSubmittingNewDebt(false);
          return;
        }

        // Find or create client_app for this debt
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Supabase client not available');

        // Try to find existing client_app
        const { data: existingApp } = await (supabase as any)
          .from('client_apps')
          .select('id')
          .eq('client_id', newDebtClientId)
          .eq('app_id', newDebtAppId)
          .maybeSingle();

        let clientAppId = existingApp?.id;

        if (!clientAppId && newDebtAppId) {
          // Create a placeholder client_app
          const { data: newApp, error: appError } = await (supabase as any)
            .from('client_apps')
            .insert({
              client_id: newDebtClientId,
              app_id: newDebtAppId,
              status: 'deposited',
              deposited: true,
              is_our_deposit: true,
              deposit_amount: parseFloat(newDebtAmount),
              deposit_source: newDebtAssignedTo || null
            })
            .select('id')
            .single();

          if (appError) throw appError;
          clientAppId = newApp.id;
        }

        await insertDepositDebt({
          client_id: newDebtClientId,
          client_app_id: clientAppId || null,
          amount: parseFloat(newDebtAmount),
          surplus: 0, // Surplus is calculated dynamically from payments (when payments exceed amount)
          deposit_source: newDebtAssignedTo || null,
          description: newDebtDescription || null,
          status: 'open'
        });
      } else {
        // Referral debt
        if (!newDebtReferralLinkId || !newDebtCreditorId) {
          setToast({
            isOpen: true,
            message: 'Please select a referral link and creditor.',
            type: 'error'
          });
          setIsSubmittingNewDebt(false);
          return;
        }

        await insertReferralDebt({
          referral_link_id: newDebtReferralLinkId,
          creditor_client_id: newDebtCreditorId,
          debtor_client_id: newDebtClientId || null,
          amount: parseFloat(newDebtAmount),
          description: newDebtDescription || null,
          status: 'open'
        });
      }
      
      await mutateReferralDebts();
      await mutateDepositDebts();
      
      // Reset form
      setNewDebtType('deposit');
      setNewDebtAmount('');
      // Surplus is calculated dynamically, no need to reset
      setNewDebtClientId('');
      setNewDebtAppId('');
      setNewDebtDescription('');
      setNewDebtAssignedTo('');
      setNewDebtReferralLinkId('');
      setNewDebtCreditorId('');
      setClientSearch('');
      setNewDebtModal({ isOpen: false });
      
      setToast({
        isOpen: true,
        message: 'Debt created successfully.',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to create debt:', error);
      setToast({
        isOpen: true,
        message: 'Failed to create debt. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSubmittingNewDebt(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Debts" description="Loading debts..." />
        <LoadingSpinner message="Loading debts..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Debts" description="Error loading debts" />
        <ErrorMessage error={error} onRetry={() => { mutateReferralDebts(); mutateDepositDebts(); }} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Debts"
        description="Monitor referral link debts and fronted deposits (our deposits)."
        actions={
          <button
            onClick={() => setNewDebtModal({ isOpen: true })}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            + New Debt
          </button>
        }
      />
      
      {/* Payments to Receive Section */}
      {paymentsToReceive.length > 0 && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#0369a1' }}>
            💰 Pagamenti da Ricevere (Referral Link Owners)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {paymentsToReceive.map((item) => (
              <div key={item.ownerId} style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{item.ownerName}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Totale: €{item.totalAmount.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  Pagato: €{item.totalPaid.toFixed(2)}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: item.remaining > 0 ? '#dc2626' : '#16a34a' }}>
                  Da ricevere: €{item.remaining.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FiltersBar>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="settled">Settled / Paid Back</option>
        </select>
        <select value={creditorFilter} onChange={(event) => setCreditorFilter(event.target.value)}>
          <option value="all">All creditors</option>
          <option value="us">Us (Deposit Debts)</option>
          {(() => {
            const clientsArray = Array.isArray(allClients) ? allClients : [];
            const referralDebtsArray = Array.isArray(referralDebts) ? referralDebts : [];
            return Array.from(new Set(referralDebtsArray.map((d: any) => d.creditor_client_id).filter(Boolean))).map((creditorId) => {
              const creditor = clientsArray.find((c: any) => c.id === creditorId);
              const creditorName = creditor ? `${creditor.name} ${creditor.surname ?? ''}`.trim() : creditorId;
              return (
                <option key={creditorId} value={creditorId}>
                  {creditorName}
                </option>
              );
            });
          })()}
        </select>
        <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
          <option value="all">All users</option>
          {USER_OPTIONS.map((user) => (
            <option key={user} value={user}>
              {user}
            </option>
          ))}
        </select>
      </FiltersBar>
      {filteredRows.length === 0 ? (
        <EmptyState
          title="No debts found"
          message={
            statusFilter !== 'all' || creditorFilter !== 'all' || userFilter !== 'all'
              ? 'No debts match your current filters.'
              : 'No debts have been recorded yet.'
          }
        />
      ) : (
        <>
        <DataTable
          data={paginatedRows}
          onRowClick={(row) => {
            setDebtDetailModal({ isOpen: true, debt: row });
          }}
          rowStyle={{ cursor: 'pointer' }}
        columns={[
          { key: 'debtType', header: 'Type', render: (row) => row.debtType === 'deposit' ? '💰 Deposit' : '🔗 Referral' },
          { key: 'creditorName', header: 'Creditor' },
          { key: 'debtorName', header: 'Debtor' },
          { key: 'linkUrl', header: 'Source / Link', render: (row) => row.description || row.linkUrl || '—' },
          { 
            key: 'amount', 
            header: 'Amount', 
            render: (row) => {
              const baseAmount = Number(row.amount || 0);
              // Use calculatedSurplus if available (from row mapping), otherwise calculate it
              const calculatedSurplus = row.surplus !== undefined 
                ? Number(row.surplus) 
                : (row.debtType === 'deposit' ? Math.max(0, Number(row.paidAmount || 0) - baseAmount) : 0);
              const total = row.totalAmount || (baseAmount + calculatedSurplus);
              const paid = Number(row.paidAmount || 0).toFixed(2);
              const remaining = Number(row.remainingAmount || 0).toFixed(2);
              return (
                <div>
                  <div>
                    €{Number(total).toFixed(2)}
                    {calculatedSurplus > 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                        (€{baseAmount.toFixed(2)} + €{calculatedSurplus.toFixed(2)} surplus)
                      </span>
                    )}
                  </div>
                  {row.paidAmount > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Paid: €{paid} | Remaining: €{remaining}
                    </div>
                  )}
                </div>
              );
            }
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => {
              const displayStatus = row.status === 'paid_back' ? 'settled' : row.status;
              return <StatusBadge status={displayStatus} />;
            }
          },
          {
            key: 'assigned_to',
            header: 'Assigned To',
            render: (row) => row.assigned_to || '—'
          },
          {
            key: 'created_at',
            header: 'Created',
            render: (row) => new Date(row.created_at).toLocaleDateString()
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => {
              const isSettled = row.status === 'settled' || row.status === 'paid_back';
              // For deposit debts, include surplus in the calculation
              let remaining = row.remainingAmount;
              if (!remaining) {
                const baseAmount = Number(row.amount || 0);
                const paidAmount = Number(row.paidAmount || 0);
                // Surplus is calculated dynamically: if payments exceed original amount, the excess is surplus
                const calculatedSurplus = row.debtType === 'deposit' 
                  ? Math.max(0, paidAmount - baseAmount)
                  : 0;
                const totalAmount = baseAmount + calculatedSurplus;
                remaining = totalAmount - paidAmount;
              }
              return !isSettled ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {remaining > 0 && (
                    <button
                      onClick={() => handlePartialPaymentClick(row)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.85rem',
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Add Payment
                    </button>
                  )}
                  <button
                    onClick={() => handleSettleDebtClick(row)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.85rem',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {row.debtType === 'deposit' ? 'Mark paid back' : 'Mark settled'}
                  </button>
                </div>
              ) : (
                '—'
              );
            }
          }
        ]}
        />
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            onPageSizeChange={setPageSize}
          />
        )}
        </>
      )}

      {/* New Debt Modal */}
      {newDebtModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>New Debt</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Debt Type *</label>
                <select
                  value={newDebtType}
                  onChange={(e) => setNewDebtType(e.target.value as 'referral' | 'deposit')}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                >
                  <option value="deposit">Deposit (Our Deposit)</option>
                  <option value="referral">Referral Link Debt</option>
                </select>
              </div>

              {newDebtType === 'deposit' ? (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Client *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={clientInputRef}
                        type="text"
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Search client..."
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      />
                      {showClientDropdown && filteredClients.length > 0 && (
                        <div
                          ref={clientDropdownRef}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 10001,
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          {filteredClients.map((client: any) => (
                            <div
                              key={client.id}
                              onClick={() => {
                                setNewDebtClientId(client.id);
                                setClientSearch(`${client.name} ${client.surname || ''}`.trim());
                                setShowClientDropdown(false);
                              }}
                              style={{
                                padding: '0.75rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #e2e8f0'
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.backgroundColor = '#f1f5f9';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
                              }}
                            >
                              {client.name} {client.surname || ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>App (Optional)</label>
                    <select
                      value={newDebtAppId}
                      onChange={(e) => setNewDebtAppId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      <option value="">No app</option>
                      {Array.isArray(allApps) && allApps.map((app: any) => (
                        <option key={app.id} value={app.id}>{app.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Amount (Deposit) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newDebtAmount}
                      onChange={(e) => setNewDebtAmount(e.target.value)}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Referral Link *</label>
                    <select
                      value={newDebtReferralLinkId}
                      onChange={(e) => setNewDebtReferralLinkId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      <option value="">Select referral link...</option>
                      {Array.isArray(referralLinks) && referralLinks.map((link: any) => (
                        <option key={link.id} value={link.id}>
                          {link.account_name || link.code || link.url} - {link.apps?.name || 'Unknown app'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Creditor (Link Owner) *</label>
                    <select
                      value={newDebtCreditorId}
                      onChange={(e) => setNewDebtCreditorId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      <option value="">Select creditor...</option>
                      {Array.isArray(allClients) && allClients.map((client: any) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.surname || ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Debtor (Optional)</label>
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      placeholder="Search client..."
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    />
                    {showClientDropdown && filteredClients.length > 0 && (
                      <div
                        ref={clientDropdownRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: 'white',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 10001,
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        {filteredClients.map((client: any) => (
                          <div
                            key={client.id}
                            onClick={() => {
                              setNewDebtClientId(client.id);
                              setClientSearch(`${client.name} ${client.surname || ''}`.trim());
                              setShowClientDropdown(false);
                            }}
                            style={{
                              padding: '0.75rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #e2e8f0'
                            }}
                          >
                            {client.name} {client.surname || ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {newDebtType === 'referral' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Amount (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDebtAmount}
                    onChange={(e) => setNewDebtAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Assigned To (User)</label>
                <select
                  value={newDebtAssignedTo}
                  onChange={(e) => setNewDebtAssignedTo(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                >
                  <option value="">No assignment</option>
                  {USER_OPTIONS.map((user) => (
                    <option key={user} value={user}>
                      {user.charAt(0).toUpperCase() + user.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Description / Notes</label>
                <textarea
                  value={newDebtDescription}
                  onChange={(e) => setNewDebtDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  setNewDebtModal({ isOpen: false });
                  setNewDebtType('deposit');
                  setNewDebtAmount('');
                  setNewDebtClientId('');
                  setNewDebtAppId('');
                  setNewDebtDescription('');
                  setNewDebtAssignedTo('');
                  setNewDebtReferralLinkId('');
                  setNewDebtCreditorId('');
                  setClientSearch('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleNewDebtSubmit}
                disabled={isSubmittingNewDebt}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmittingNewDebt ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingNewDebt ? 0.6 : 1
                }}
              >
                {isSubmittingNewDebt ? 'Creating...' : 'Create Debt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {partialPaymentModal.isOpen && partialPaymentModal.debt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>Add Partial Payment</h2>
            
            {(() => {
              // Calculate total amount including surplus for deposit debts
              const baseAmount = Number(partialPaymentModal.debt.amount || 0);
              const paidAmount = Number(partialPaymentModal.debt.paidAmount || 0);
              // Surplus is calculated dynamically: if payments exceed original amount, the excess is surplus
              const calculatedSurplus = partialPaymentModal.debt.debtType === 'deposit' 
                ? Math.max(0, paidAmount - baseAmount)
                : 0;
              // Prefer totalAmount if it exists (already calculated with surplus), otherwise calculate
              const totalAmount = partialPaymentModal.debt.totalAmount 
                ? Number(partialPaymentModal.debt.totalAmount) 
                : (baseAmount + calculatedSurplus);
              // Remaining: how much is still owed on the original amount
              // If paid >= baseAmount, remaining is 0 (debt is fully paid, any extra is surplus)
              // Otherwise, remaining = baseAmount - paidAmount (still owe the difference)
              const remaining = paidAmount >= baseAmount ? 0 : (baseAmount - paidAmount);
              
              return (
                <>
                  <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      Total Amount: €{totalAmount.toFixed(2)}
                      {calculatedSurplus > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                          (€{baseAmount.toFixed(2)} original + €{calculatedSurplus.toFixed(2)} from overpayments)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      Paid: €{paidAmount.toFixed(2)}
                    </div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: remaining > 0 ? '#dc2626' : '#16a34a' }}>
                        {remaining > 0 ? (
                          <>Remaining: €{remaining.toFixed(2)}</>
                        ) : (
                          <>Fully Paid{calculatedSurplus > 0 && ` (€${calculatedSurplus.toFixed(2)} surplus)`}</>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Payment Amount (€) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={partialPaymentAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow typing any value, validation happens on submit
                            setPartialPaymentAmount(val);
                          }}
                          placeholder="0.00"
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                          {remaining > 0 ? (
                            <>Minimum to pay off: €{remaining.toFixed(2)}. You can pay any amount, including more than this.</>
                          ) : (
                            <>Debt is fully paid. You can add additional payments if needed.</>
                          )}
                        </div>
                      </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Paid To (Who receives the payment) *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={paidToInputRef}
                    type="text"
                    value={partialPaymentPaidToSearch}
                    onChange={(e) => {
                      setPartialPaymentPaidToSearch(e.target.value);
                      setShowPaidToDropdown(true);
                      // Update the actual value if it matches exactly
                      const exactMatch = USER_OPTIONS.find(u => u.toLowerCase() === e.target.value.toLowerCase());
                      if (exactMatch) {
                        setPartialPaymentPaidTo(exactMatch);
                      } else {
                        setPartialPaymentPaidTo(e.target.value.trim());
                      }
                    }}
                    onFocus={() => setShowPaidToDropdown(true)}
                    placeholder="Search or type name..."
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                  {showPaidToDropdown && filteredPaidToUsers.length > 0 && (
                    <div
                      ref={paidToDropdownRef}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 10001,
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        marginTop: '0.25rem'
                      }}
                    >
                      {filteredPaidToUsers.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setPartialPaymentPaidTo(item.name);
                            setPartialPaymentPaidToSearch(item.name);
                            setShowPaidToDropdown(false);
                          }}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #e2e8f0',
                            backgroundColor: item.isNew ? '#f0fdf4' : 'white'
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = item.isNew ? '#dcfce7' : '#f1f5f9';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = item.isNew ? '#f0fdf4' : 'white';
                          }}
                        >
                          {item.isNew ? (
                            <span>
                              <span style={{ color: '#16a34a', fontWeight: '600' }}>+ Create: </span>
                              {item.name}
                            </span>
                          ) : (
                            item.name
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Who is receiving this payment?
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Notes</label>
                <textarea
                  value={partialPaymentNotes}
                  onChange={(e) => setPartialPaymentNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', resize: 'vertical' }}
                />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                      <button
                        onClick={() => {
                          setPartialPaymentModal({ isOpen: false, debt: null });
                          setPartialPaymentAmount('');
                          setPartialPaymentNotes('');
                          setPartialPaymentPaidTo('');
                          setPartialPaymentPaidToSearch('');
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#e2e8f0',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePartialPaymentConfirm}
                        disabled={isSubmittingPartialPayment}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: isSubmittingPartialPayment ? 'not-allowed' : 'pointer',
                          opacity: isSubmittingPartialPayment ? 0.6 : 1
                        }}
                      >
                        {isSubmittingPartialPayment ? 'Recording...' : 'Record Payment'}
                      </button>
                    </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Debt Detail Modal */}
      {debtDetailModal.isOpen && debtDetailModal.debt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                Debt Details
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {editingDebtId !== debtDetailModal.debt.id && (
                  <button
                    onClick={() => {
                      setEditingDebtId(debtDetailModal.debt.id);
                      setEditDebtAmount(debtDetailModal.debt.amount?.toString() || '');
                      setEditDebtDescription(debtDetailModal.debt.description || '');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setDebtDetailModal({ isOpen: false, debt: null });
                    setEditingDebtId(null);
                    setEditDebtAmount('');
                    setEditDebtDescription('');
                  }}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {(() => {
              const debt = debtDetailModal.debt;
              const paymentsForDebt = Array.isArray(debtPayments) ? debtPayments.filter((p: any) => 
                p.debt_type === debt.debtType && p.debt_id === debt.id
              ) : [];
              const isEditing = editingDebtId === debt.id;
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Debt Information */}
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>Debt Information</h3>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Original Amount (€) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editDebtAmount}
                            onChange={(e) => setEditDebtAmount(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Description</label>
                          <textarea
                            value={editDebtDescription}
                            onChange={(e) => setEditDebtDescription(e.target.value)}
                            rows={3}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', resize: 'vertical' }}
                            placeholder="Optional description..."
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => {
                              setEditingDebtId(null);
                              setEditDebtAmount('');
                              setEditDebtDescription('');
                            }}
                            disabled={isSavingDebtEdit}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#e2e8f0',
                              color: '#475569',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: isSavingDebtEdit ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '500'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (!editDebtAmount || parseFloat(editDebtAmount) <= 0) {
                                setToast({
                                  isOpen: true,
                                  message: 'Please enter a valid amount.',
                                  type: 'error'
                                });
                                return;
                              }
                              
                              setIsSavingDebtEdit(true);
                              try {
                                const updateData: any = {
                                  amount: parseFloat(editDebtAmount)
                                };
                                if (editDebtDescription.trim()) {
                                  updateData.description = editDebtDescription.trim();
                                } else {
                                  updateData.description = null;
                                }
                                
                                if (debt.debtType === 'deposit') {
                                  await updateDepositDebt(updateData, debt.id, {
                                    onSuccess: () => {
                                      mutateDepositDebts();
                                      setEditingDebtId(null);
                                      setEditDebtAmount('');
                                      setEditDebtDescription('');
                                      setDebtDetailModal({ isOpen: false, debt: null });
                                      setToast({
                                        isOpen: true,
                                        message: 'Debt updated successfully.',
                                        type: 'success'
                                      });
                                      setIsSavingDebtEdit(false);
                                    },
                                    onError: (error) => {
                                      console.error('Error updating debt:', error);
                                      setToast({
                                        isOpen: true,
                                        message: 'Failed to update debt. Please try again.',
                                        type: 'error'
                                      });
                                      setIsSavingDebtEdit(false);
                                    }
                                  });
                                } else {
                                  await updateReferralDebt(updateData, debt.id, {
                                    onSuccess: () => {
                                      mutateReferralDebts();
                                      setEditingDebtId(null);
                                      setEditDebtAmount('');
                                      setEditDebtDescription('');
                                      setDebtDetailModal({ isOpen: false, debt: null });
                                      setToast({
                                        isOpen: true,
                                        message: 'Debt updated successfully.',
                                        type: 'success'
                                      });
                                      setIsSavingDebtEdit(false);
                                    },
                                    onError: (error) => {
                                      console.error('Error updating debt:', error);
                                      setToast({
                                        isOpen: true,
                                        message: 'Failed to update debt. Please try again.',
                                        type: 'error'
                                      });
                                      setIsSavingDebtEdit(false);
                                    }
                                  });
                                }
                              } catch (error) {
                                console.error('Error updating debt:', error);
                                setToast({
                                  isOpen: true,
                                  message: 'Failed to update debt. Please try again.',
                                  type: 'error'
                                });
                                setIsSavingDebtEdit(false);
                              }
                            }}
                            disabled={isSavingDebtEdit}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: isSavingDebtEdit ? '#cbd5e1' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: isSavingDebtEdit ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              opacity: isSavingDebtEdit ? 0.6 : 1
                            }}
                          >
                            {isSavingDebtEdit ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', fontSize: '0.9rem' }}>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Type</div>
                          <div style={{ fontWeight: '500' }}>{debt.debtType === 'deposit' ? '💰 Deposit' : '🔗 Referral'}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Status</div>
                          <div><StatusBadge status={debt.status === 'paid_back' ? 'settled' : debt.status} /></div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Creditor</div>
                          <div style={{ fontWeight: '500' }}>{debt.creditorName}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Debtor</div>
                          <div style={{ fontWeight: '500' }}>{debt.debtorName}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Original Amount</div>
                          <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                            €{Number(debt.amount || 0).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Total Amount</div>
                          <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                            {(() => {
                              const baseAmount = Number(debt.amount || 0);
                              const paidAmount = Number(debt.paidAmount || 0);
                              // Surplus is calculated dynamically: if payments exceed original amount, the excess is surplus
                              const calculatedSurplus = debt.debtType === 'deposit' 
                                ? Math.max(0, paidAmount - baseAmount)
                                : 0;
                              const totalAmount = debt.totalAmount || (baseAmount + calculatedSurplus);
                              return (
                                <>
                                  €{Number(totalAmount).toFixed(2)}
                                  {calculatedSurplus > 0 && (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem', fontWeight: '400' }}>
                                      (€{baseAmount.toFixed(2)} original + €{calculatedSurplus.toFixed(2)} from overpayments)
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Paid Amount</div>
                          <div style={{ fontWeight: '500', color: '#16a34a' }}>€{Number(debt.paidAmount || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Remaining Amount</div>
                          <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#dc2626' }}>€{Number(debt.remainingAmount || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Assigned To</div>
                          <div style={{ fontWeight: '500' }}>{debt.assigned_to || '—'}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Created</div>
                          <div style={{ fontWeight: '500' }}>{new Date(debt.created_at).toLocaleString()}</div>
                        </div>
                        {debt.settled_at && (
                          <div>
                            <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Settled At</div>
                            <div style={{ fontWeight: '500' }}>{new Date(debt.settled_at).toLocaleString()}</div>
                          </div>
                        )}
                        {debt.paid_back_at && (
                          <div>
                            <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Paid Back At</div>
                            <div style={{ fontWeight: '500' }}>{new Date(debt.paid_back_at).toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {debt.description && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Description</div>
                        <div style={{ fontWeight: '500', whiteSpace: 'pre-wrap' }}>{debt.description}</div>
                      </div>
                    )}
                    {debt.notes && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Notes</div>
                        <div style={{ fontWeight: '500', whiteSpace: 'pre-wrap' }}>{debt.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Payments History */}
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
                      Payment History ({paymentsForDebt.length})
                    </h3>
                    {paymentsForDebt.length === 0 ? (
                      <div style={{ color: '#64748b', fontStyle: 'italic' }}>No payments recorded yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {paymentsForDebt
                          .sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                          .map((payment: any) => {
                            const isEditingPayment = editingPaymentId === payment.id;
                            return (
                              <div 
                                key={payment.id}
                                style={{
                                  padding: '0.75rem',
                                  backgroundColor: 'white',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0'
                                }}
                              >
                                {isEditingPayment ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>Amount (€) *</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editPaymentAmount}
                                        onChange={(e) => setEditPaymentAmount(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.875rem' }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>Paid To *</label>
                                      <input
                                        type="text"
                                        value={editPaymentPaidTo}
                                        onChange={(e) => setEditPaymentPaidTo(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.875rem' }}
                                        placeholder="Who received this payment?"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500' }}>Notes</label>
                                      <textarea
                                        value={editPaymentNotes}
                                        onChange={(e) => setEditPaymentNotes(e.target.value)}
                                        rows={2}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.875rem', resize: 'vertical' }}
                                        placeholder="Optional notes..."
                                      />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                      <button
                                        onClick={() => {
                                          setEditingPaymentId(null);
                                          setEditPaymentAmount('');
                                          setEditPaymentPaidTo('');
                                          setEditPaymentNotes('');
                                        }}
                                        disabled={isSavingPaymentEdit}
                                        style={{
                                          padding: '0.4rem 0.75rem',
                                          backgroundColor: '#e2e8f0',
                                          color: '#475569',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: isSavingPaymentEdit ? 'not-allowed' : 'pointer',
                                          fontSize: '0.875rem',
                                          fontWeight: '500'
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!editPaymentAmount || parseFloat(editPaymentAmount) <= 0) {
                                            setToast({
                                              isOpen: true,
                                              message: 'Please enter a valid amount.',
                                              type: 'error'
                                            });
                                            return;
                                          }
                                          if (!editPaymentPaidTo || !editPaymentPaidTo.trim()) {
                                            setToast({
                                              isOpen: true,
                                              message: 'Please specify who received this payment.',
                                              type: 'error'
                                            });
                                            return;
                                          }
                                          
                                          setIsSavingPaymentEdit(true);
                                          try {
                                            await updateDebtPayment({
                                              amount: parseFloat(editPaymentAmount),
                                              created_by: editPaymentPaidTo.trim(),
                                              notes: editPaymentNotes.trim() || null
                                            }, payment.id, {
                                              onSuccess: () => {
                                                mutateDebtPayments();
                                                mutateReferralDebts();
                                                mutateDepositDebts();
                                                setEditingPaymentId(null);
                                                setEditPaymentAmount('');
                                                setEditPaymentPaidTo('');
                                                setEditPaymentNotes('');
                                                setToast({
                                                  isOpen: true,
                                                  message: 'Payment updated successfully.',
                                                  type: 'success'
                                                });
                                                setIsSavingPaymentEdit(false);
                                              },
                                              onError: (error) => {
                                                console.error('Error updating payment:', error);
                                                setToast({
                                                  isOpen: true,
                                                  message: 'Failed to update payment. Please try again.',
                                                  type: 'error'
                                                });
                                                setIsSavingPaymentEdit(false);
                                              }
                                            });
                                          } catch (error) {
                                            console.error('Error updating payment:', error);
                                            setToast({
                                              isOpen: true,
                                              message: 'Failed to update payment. Please try again.',
                                              type: 'error'
                                            });
                                            setIsSavingPaymentEdit(false);
                                          }
                                        }}
                                        disabled={isSavingPaymentEdit}
                                        style={{
                                          padding: '0.4rem 0.75rem',
                                          backgroundColor: isSavingPaymentEdit ? '#cbd5e1' : '#10b981',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: isSavingPaymentEdit ? 'not-allowed' : 'pointer',
                                          fontSize: '0.875rem',
                                          fontWeight: '500',
                                          opacity: isSavingPaymentEdit ? 0.6 : 1
                                        }}
                                      >
                                        {isSavingPaymentEdit ? 'Saving...' : 'Save'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                      <div>
                                        <div style={{ fontWeight: '600', fontSize: '1rem' }}>€{Number(payment.amount).toFixed(2)}</div>
                                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                          {new Date(payment.payment_date).toLocaleString()}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {payment.created_by && (
                                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                            Paid to: <span style={{ fontWeight: '500' }}>{payment.created_by}</span>
                                          </div>
                                        )}
                                        <button
                                          onClick={() => {
                                            setEditingPaymentId(payment.id);
                                            setEditPaymentAmount(payment.amount?.toString() || '');
                                            setEditPaymentPaidTo(payment.created_by || '');
                                            setEditPaymentNotes(payment.notes || '');
                                          }}
                                          style={{
                                            padding: '0.25rem 0.5rem',
                                            backgroundColor: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: '500'
                                          }}
                                          title="Edit payment"
                                        >
                                          ✏️ Edit
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('Delete button clicked for payment:', payment.id);
                                            setDeletePaymentModal({ isOpen: true, paymentId: payment.id });
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                          }}
                                          style={{
                                            padding: '0.25rem 0.5rem',
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: '500',
                                            position: 'relative',
                                            zIndex: 10
                                          }}
                                          title="Delete payment"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                    {payment.notes && (
                                      <div style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                                        {payment.notes}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setDebtDetailModal({ isOpen: false, debt: null })}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#e2e8f0',
                        color: '#475569',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>
                    {debt.status !== 'settled' && debt.status !== 'paid_back' && (
                      <>
                        {debt.remainingAmount > 0 && (
                          <button
                            onClick={() => {
                              setDebtDetailModal({ isOpen: false, debt: null });
                              handlePartialPaymentClick(debt);
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            Add Payment
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDebtDetailModal({ isOpen: false, debt: null });
                            handleSettleDebtClick(debt);
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          {debt.debtType === 'deposit' ? 'Mark Paid Back' : 'Mark Settled'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={settleDebtModal.isOpen}
        title={settleDebtModal.debt?.debtType === 'deposit' ? 'Mark Deposit as Paid Back?' : 'Mark Debt as Settled?'}
        message={
          settleDebtModal.debt
            ? `Are you sure you want to mark this ${settleDebtModal.debt.debtType === 'deposit' ? 'deposit' : 'debt'} as ${settleDebtModal.debt.debtType === 'deposit' ? 'paid back' : 'settled'}? This action cannot be undone.`
            : ''
        }
        confirmLabel={settleDebtModal.debt?.debtType === 'deposit' ? 'Mark Paid Back' : 'Mark Settled'}
        cancelLabel="Cancel"
        onConfirm={handleSettleDebtConfirm}
        onCancel={() => setSettleDebtModal({ isOpen: false, debt: null })}
        variant="info"
      />
      <ConfirmationModal
        isOpen={deletePaymentModal.isOpen}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (!deletePaymentModal.paymentId) return;
          try {
            await deleteDebtPayment(deletePaymentModal.paymentId, {
              onSuccess: () => {
                mutateDebtPayments();
                mutateReferralDebts();
                mutateDepositDebts();
                setDeletePaymentModal({ isOpen: false, paymentId: null });
                setToast({
                  isOpen: true,
                  message: 'Payment deleted successfully.',
                  type: 'success'
                });
              },
              onError: (error) => {
                console.error('Error deleting payment:', error);
                setToast({
                  isOpen: true,
                  message: 'Failed to delete payment. Please try again.',
                  type: 'error'
                });
                setDeletePaymentModal({ isOpen: false, paymentId: null });
              }
            });
          } catch (error) {
            console.error('Error deleting payment:', error);
            setToast({
              isOpen: true,
              message: 'Failed to delete payment. Please try again.',
              type: 'error'
            });
            setDeletePaymentModal({ isOpen: false, paymentId: null });
          }
        }}
        onCancel={() => setDeletePaymentModal({ isOpen: false, paymentId: null })}
      />
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'success' })}
      />
    </div>
  );
}
